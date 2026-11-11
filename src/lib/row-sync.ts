import type { VocabDatabase } from './db'
import { rowTables, encodeRow, decodeRow, stable, type RowTable, type WireRow, type LocalRow, type SyncedRow } from './row-codec'
import { remoteMap, type RowTransport } from './row-transport'
import { nextReview, type ReviewRecord, type Grade } from './review'
export type RowSyncMode = 'merge' | 'upload' | 'download'
export type RowSyncStatus = { phase: 'syncing' | 'saved' | 'error'; error?: unknown }
const key = (table: RowTable, id: string) => table + ':' + id
export async function readLocalRows(db: VocabDatabase) {
  return db.transaction('r', db.tables, async () => ({
    tables: Object.fromEntries(await Promise.all(rowTables.map(async table => [table, new Map((await db[table].toArray()).map(row => [row.id, row as LocalRow]))]))) as Record<RowTable, Map<string, LocalRow>>,
    bases: await db.syncRows.toArray(),
  }))
}
export async function syncRowCycle(db: VocabDatabase, transport: RowTransport, active = () => true, mode: RowSyncMode = 'merge') {
  const captured = await readLocalRows(db)
  const base = new Map(captured.bases.map(row => [row.key, row]))
  const remote = {} as Record<RowTable, Map<string, WireRow>>
  for (const table of rowTables) {
    remote[table] = remoteMap(table, await transport.load(table, captured.bases.filter(row => row.table === table)))
    if (!active()) return
  }
  const localValue = (table: RowTable, id: string) => {
    const row = captured.tables[table].get(id)
    return row ? encodeRow(table, row) : null
  }
  const dirty = (table: RowTable, id: string) => stable(localValue(table, id)) !== stable(base.get(key(table, id))?.value ?? null)
  const aliveFolders = new Set([...remote.folders].filter(([, row]) => !row.deleted_at).map(([id]) => id))
  for (const [id] of captured.tables.folders) if (!base.has(key('folders', id))) aliveFolders.add(id)
  const pushed = new Set<string>()
  for (const table of mode === 'download' ? [] : ['folders', 'templates', 'notes'] as const) {
    const ids = new Set([...captured.tables[table].keys(), ...captured.bases.filter(row => row.table === table).map(row => row.id)])
    // Create/update parents before child folders, independent of IndexedDB key order.
    const ordered = [...ids]
    if (table === 'folders') {
      const depth = (id: string) => { let n = 0; const seen = new Set<string>(); let row = captured.tables.folders.get(id) as WireRow | undefined; while (row?.parentId && !seen.has(row.parentId)) { seen.add(row.parentId); n++; row = captured.tables.folders.get(row.parentId) as WireRow | undefined } return n }
      ordered.sort((a, b) => depth(a) - depth(b))
    }
    // Deletions run after edits so child folders can be reparented first.
    ordered.sort((a, b) => Number(!captured.tables[table].has(a)) - Number(!captured.tables[table].has(b)))
    for (const id of ordered) {
      if (!active()) return
      if (!dirty(table, id)) continue
      const previous = base.get(key(table, id))
      const server = remote[table].get(id)
      // Missing access or a remote tombstone takes precedence over pending edits.
      if (previous && !server || server?.deleted_at) {
        if (mode === 'upload' && !localValue(table, id) && server?.deleted_at) pushed.add(key(table, id))
        if (mode === 'upload' && localValue(table, id)) throw Object.assign(new Error('Dữ liệu đã bị xóa hoặc bạn không còn quyền truy cập. Hãy đồng bộ hai chiều trước.'), { code: 'UPLOAD_UNAVAILABLE' })
        continue
      }
      const value = localValue(table, id)
      if (table === 'notes' && value && !aliveFolders.has(value.folder_id)) continue
      if (!value && !server) continue
      const theirs = server ? encodeRow(table, decodeRow(table, server)) : null
      if (stable(value) === stable(theirs)) { pushed.add(key(table, id)); continue }
      let patch: WireRow | null = value
      if (value && previous?.value && theirs) {
        patch = Object.fromEntries(Object.keys(value).filter(field => stable(value[field]) !== stable(previous.value![field])).map(field => [field, value[field]]))
        if (!Object.keys(patch).length) continue
      }
      const saved = await transport.write(table, id, patch, server)
      if (table === 'folders') {
        saved.permission = server?.permission ?? 'owner'
        if (saved.deleted_at) aliveFolders.delete(id)
        else aliveFolders.add(id)
      }
      remote[table].set(id, saved)
      pushed.add(key(table, id))
    }
  }
  const aliveNotes = new Set([...remote.notes].filter(([, row]) => !row.deleted_at && aliveFolders.has(row.folder_id)).map(([id]) => id))
  for (const [id, row] of mode === 'download' ? [] : captured.tables.reviews) {
    if (!active()) return
    if (!aliveNotes.has((row as ReviewRecord).noteId)) continue
    const pendingLogs = [...captured.tables.reviewLogs.values()].filter(log => {
      const value = log as WireRow
      return value.cardId === id && !remote.reviewLogs.has(value.id)
    })
    if (!pendingLogs.length) {
      if (remote.reviews.has(id)) pushed.add(key('reviews', id))
      continue
    }
    const server = remote.reviews.get(id)
    let progress = encodeRow('reviews', row)
    if (server && Number(server.review_revision) !== Number(base.get(key('reviews', id))?.value?.review_revision ?? 0)) {
      // Replay newer offline grades onto the server schedule; retain older events
      // in history without moving the current schedule back in time.
      let record = decodeRow('reviews', server) as ReviewRecord
      for (const log of pendingLogs.sort((a, b) => (a as WireRow).log.review.getTime() - (b as WireRow).log.review.getTime())) {
        const event = (log as WireRow).log
        if (record.last_review && event.review <= record.last_review) continue
        const result = nextReview(record, event.rating as Grade, event.review)
        record = { ...result.card, id, noteId: record.noteId, revision: record.revision, lastRating: event.rating }
      }
      progress = encodeRow('reviews', { ...record, revision: Number(server.review_revision) + pendingLogs.length })
    }
    const logs = pendingLogs.map(log => ({ id: log.id, ...encodeRow('reviewLogs', log) }))
    const saved = await transport.review(progress, Number(server?.review_revision ?? 0), logs)
    remote.reviews.set(id, saved)
    pushed.add(key('reviews', id))
    for (const log of pendingLogs) pushed.add(key('reviewLogs', log.id))
    // Fetch server timestamps for the newly committed immutable log rows.
    remote.reviewLogs = remoteMap('reviewLogs', await transport.load('reviewLogs', captured.bases.filter(row => row.table === 'reviewLogs')))
  }
  if (mode === 'upload') {
    for (const [id, log] of captured.tables.reviewLogs) {
      const server = remote.reviewLogs.get(id)
      if (server && stable(encodeRow('reviewLogs', log)) === stable(encodeRow('reviewLogs', decodeRow('reviewLogs', server)))) pushed.add(key('reviewLogs', id))
    }
  }
  if (!active()) return
  // Apply remote rows atomically, preserving edits made while requests ran.
  await db.transaction('rw', db.tables, async () => {
    if (!active()) return
    if (mode === 'download') {
      for (const table of rowTables) {
        const current = (await db[table].toArray()).sort((a, b) => a.id.localeCompare(b.id))
        const before = [...captured.tables[table].values()].sort((a, b) => a.id.localeCompare(b.id))
        if (stable(current) !== stable(before)) throw Object.assign(new Error('Local data changed during download'), { code: 'LOCAL_CHANGED_DURING_DOWNLOAD' })
      }
    }
    const effectiveFolders = new Set(aliveFolders)
    for (const folder of await db.folders.toArray()) if (!captured.tables.folders.has(folder.id) && !base.has(key('folders', folder.id))) effectiveFolders.add(folder.id)
    const effectiveNotes = new Set(aliveNotes)
    for (const note of await db.notes.toArray()) if (!captured.tables.notes.has(note.id) && !base.has(key('notes', note.id)) && effectiveFolders.has(note.folderId ?? '')) effectiveNotes.add(note.id)
    if (mode === 'download' && rowTables.some(table => captured.tables[table].size)) {
      await db.syncBackups.put({ id: crypto.randomUUID(), createdAt: new Date().toISOString(),
        tables: Object.fromEntries(await Promise.all(rowTables.map(async table => [table, await db[table].toArray()]))), bases: await db.syncRows.toArray() })
      const backups = await db.syncBackups.orderBy('createdAt').reverse().toArray()
      await db.syncBackups.bulkDelete(backups.slice(3).map(row => row.id))
    }
    const acknowledgements: SyncedRow[] = []
    for (const table of rowTables) {
      const current = new Map((await db[table].toArray()).map(row => [row.id, row as LocalRow]))
      const ids = new Set([...current.keys(), ...remote[table].keys(), ...captured.tables[table].keys()])
      for (const id of ids) {
        const server = remote[table].get(id)
        if (mode === 'upload') {
          const previous = base.get(key(table, id))
          if (pushed.has(key(table, id)) && server) acknowledgements.push({ key: key(table, id), table, id, remote: server, value: localValue(table, id) })
          else if (previous) {
            const deletedParent = ['reviews', 'reviewLogs'].includes(table) && remote.notes.get(previous.remote.note_id)?.deleted_at
            acknowledgements.push(deletedParent && !current.has(id) ? { ...previous, value: null } : previous)
          }
          continue
        }
        const accessible = server && !server.deleted_at && (table !== 'notes' || aliveFolders.has(server.folder_id)) && (!['reviews', 'reviewLogs'].includes(table) || aliveNotes.has(server.note_id))
        if (server && table === 'notes') server.readOnly = remote.folders.get(server.folder_id)?.permission === 'viewer'
        const incoming = accessible ? decodeRow(table, server) : undefined
        const currentValue = current.has(id) ? encodeRow(table, current.get(id)!) : null
        const inFlightEdit = stable(currentValue) !== stable(localValue(table, id))
        const revoked = base.has(key(table, id)) && !server || table === 'notes' && currentValue && !effectiveFolders.has(currentValue.folder_id) || ['reviews', 'reviewLogs'].includes(table) && currentValue && !effectiveNotes.has(currentValue.note_id)
        if (!inFlightEdit || revoked) {
          if (incoming) await db.table(table).put(incoming)
          else await db.table(table).delete(id)
        }
        if (server) acknowledgements.push({ key: key(table, id), table, id, remote: server, value: incoming ? encodeRow(table, incoming) : null })
      }
    }
    await db.syncRows.clear()
    await db.syncRows.bulkPut(acknowledgements)
    await db.syncMeta.put({ id: 'current', lastSyncAt: new Date().toISOString(), mode })
  })
}
export async function restoreSyncBackup(db: VocabDatabase) {
  await db.transaction('rw', db.tables, async () => {
    const backup = await db.syncBackups.orderBy('createdAt').last()
    if (!backup) throw new Error('Chưa có bản khôi phục local.')
    for (const table of rowTables) { await db[table].clear(); await db.table(table).bulkPut(backup.tables[table]) }
    await db.syncRows.clear(); await db.syncRows.bulkPut(backup.bases)
  })
}
export function hasPendingRows(local: Awaited<ReturnType<typeof readLocalRows>>) {
  const bases = new Map(local.bases.map(row => [row.key, row.value]))
  for (const table of rowTables) {
    const ids = new Set([...local.tables[table].keys(), ...local.bases.filter(row => row.table === table).map(row => row.id)])
    for (const id of ids) {
      const row = local.tables[table].get(id)
      const value = row ? encodeRow(table, row) : null
      if (stable(value) !== stable(bases.get(key(table, id)) ?? null)) return true
    }
  }
  return false
}
export function createRowSync(options: { cycle: (active: () => boolean) => Promise<void>; status: (value: RowSyncStatus) => void }) {
  let stopped = false, running = false
  async function run() {
    if (stopped || running) return
    running = true
    options.status({ phase: 'syncing' })
    try {
      await options.cycle(() => !stopped)
      if (!stopped) options.status({ phase: 'saved' })
    } catch (error) {
      if (!stopped) options.status({ phase: 'error', error })
    } finally { running = false }
  }
  return { retry: () => { void run() }, stop: () => { stopped = true } }
}
