import { contextualSyncError } from './row-sync-error'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sqlTables, localId, type RowTable, type WireRow, type SyncedRow } from './row-codec'
const pageSize = 500
const softDelete = new Set<RowTable>(['folders', 'templates', 'notes', 'grammarFolders', 'grammarEntries'])
export interface RowTransport {
  load: (table: RowTable, base: SyncedRow[]) => Promise<WireRow[]>
  write: (table: RowTable, id: string, value: WireRow | null, remote?: WireRow) => Promise<WireRow>
  review: (value: WireRow, expected: number, logs: WireRow[]) => Promise<WireRow>
}
export function createRowTransport(client: SupabaseClient, userId: string): RowTransport {
  async function list(table: RowTable, columns: string) {
    const rows: WireRow[] = []
    for (let offset = 0; ; offset += pageSize) {
      let query = client.from(sqlTables[table]).select(columns)
      if (table === 'grammarFolders' || table === 'grammarEntries') query = query.eq('owner_id', userId)
      if (['templates', 'reviews', 'reviewLogs'].includes(table)) query = query.eq('user_id', userId)
      if (table === 'reviews') query = query.order('note_id').order('card_key')
      else query = query.order('id')
      const { data, error } = await query.range(offset, offset + pageSize - 1)
      if (error) throw contextualSyncError(error, sqlTables[table], 'select')
      rows.push(...(data ?? []) as unknown as WireRow[])
      if (!data || data.length < pageSize) return rows
    }
  }
  return {
    load: async (table, base) => {
      // Read small metadata pages; fetch content only for new/changed records.
      const metadata = await list(table, table === 'reviews' ? 'note_id,card_key,updated_at' : 'id,updated_at')
      const cached = new Map(base.map(row => [row.id, row.remote]))
      const changed = metadata.filter(row => !cached.has(localId(table, row)) || cached.get(localId(table, row))!.updated_at !== row.updated_at)
      const changedIds = new Set(changed.map(row => localId(table, row)))
      const fetched = new Map<string, WireRow>()
      const fetchIds = [...new Set(changed.map(row => table === 'reviews' ? row.note_id : row.id))]
      for (let offset = 0; offset < fetchIds.length; offset += 100) {
        for (let page = 0; ; page += pageSize) {
          let query = client.from(sqlTables[table]).select('*').in(table === 'reviews' ? 'note_id' : 'id', fetchIds.slice(offset, offset + 100))
          if (table === 'grammarFolders' || table === 'grammarEntries') query = query.eq('owner_id', userId)
      if (['templates', 'reviews', 'reviewLogs'].includes(table)) query = query.eq('user_id', userId)
          if (table === 'reviews') query = query.order('note_id').order('card_key').range(page, page + pageSize - 1)
          const { data, error } = await query
          if (error) throw contextualSyncError(error, sqlTables[table], 'select')
          for (const row of data ?? []) fetched.set(localId(table, row), row)
          if (table !== 'reviews' || !data || data.length < pageSize) break
        }
      }
      const rows = metadata.map(row => {
        const id = localId(table, row)
        return fetched.get(id) ?? (changedIds.has(id) ? undefined : cached.get(id))
      }).filter((row): row is WireRow => !!row)
      if (table === 'folders') {
        const { data, error } = await client.from('folder_members').select('folder_id,role').eq('user_id', userId)
        if (error) throw contextualSyncError(error, 'folder_members', 'select')
        const roles = new Map((data ?? []).map(row => [row.folder_id, row.role]))
        return rows.map(row => ({ ...row, permission: row.owner_id === userId ? 'owner' : roles.get(row.id) ?? 'viewer' }))
      }
      return rows
    },
    write: async (table, id, value, remote) => {
      if (!softDelete.has(table)) throw new Error('Use atomic review RPC')
      let query
      if (!remote) {
        if (!value) throw new Error('Missing row')
        const owner = ['folders', 'grammarFolders', 'grammarEntries'].includes(table) ? { owner_id: userId } : table === 'notes' ? { created_by: userId } : { user_id: userId }
        query = client.from(sqlTables[table]).insert({ id, ...owner, ...value })
      } else {
        query = client.from(sqlTables[table]).update(value ?? { deleted_at: new Date().toISOString() }).eq('id', id).eq('updated_at', remote.updated_at)
      }
      const { data, error } = await query.select('*').maybeSingle()
      if (error) throw contextualSyncError(error, sqlTables[table], remote ? 'update' : 'insert')
      if (!data) throw Object.assign(new Error('Dữ liệu vừa thay đổi hoặc bạn không còn quyền sửa. Hãy thử lại.'), { code: 'ROW_CONFLICT' })
      return data
    },
    review: async (value, expected, logs) => {
      if (!logs.length && expected === 0) {
        const { data, error } = await client.from('user_card_progress').insert({ user_id: userId, note_id: value.note_id, card_key: value.card_key, due: value.due, fsrs: value.fsrs, last_rating: value.last_rating, review_revision: value.review_revision }).select('*').single()
        if (error) throw contextualSyncError(error, 'user_card_progress', 'insert')
        return data
      }
      const { data, error } = await client.rpc('save_card_review', { p_note_id: value.note_id, p_card_key: value.card_key, p_expected_revision: expected, p_progress: value, p_logs: logs })
      if (error) throw contextualSyncError(error, 'user_card_progress', 'review')
      if (!data?.[0]) throw new Error('Missing review result')
      return data[0]
    },
  }
}
export function remoteMap(table: RowTable, rows: WireRow[]) {
  return new Map(rows.map(row => [localId(table, row), row]))
}
