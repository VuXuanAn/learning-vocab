import { db } from './db'
import { parseSnapshot, type Snapshot } from './cloud-schema'
import { useSettings } from './settings'
import type { ReviewRecord } from './review'
import type { SavedReviewLog } from './review-storage'

const dataTables = () => [db.folders,db.templates,db.notes,db.reviews,db.reviewLogs]
export async function localSnapshot(): Promise<Snapshot> {
  const preferences = useSettings.getState()
  const data = await db.transaction('r', dataTables(), async () => ({folders:await db.folders.toArray(),templates:await db.templates.toArray(),notes:await db.notes.toArray(),reviews:await db.reviews.toArray(),reviewLogs:await db.reviewLogs.toArray()}))
  return parseSnapshot(JSON.parse(JSON.stringify({version:1,createdAt:new Date().toISOString(),...data,preferences:{reminderEnabled:preferences.reminderEnabled,reminderMinutes:preferences.reminderMinutes,autoVoice:preferences.autoVoice}})))
}
export async function restoreSnapshot(raw: unknown, userId: string, revision: number) {
  const snapshot = parseSnapshot(raw)
  await db.transaction('rw', [...dataTables(), db.localBackups, db.cloudMeta], async () => {
    const backup = await localSnapshot()
    await db.localBackups.add({id:crypto.randomUUID(),createdAt:new Date().toISOString(),payload:backup,owner:await db.cloudMeta.get('current')})
    await Promise.all(dataTables().map(table=>table.clear()))
    await db.folders.bulkAdd(snapshot.folders)
    await db.templates.bulkAdd(snapshot.templates)
    await db.notes.bulkAdd(snapshot.notes)
    await db.reviews.bulkAdd(snapshot.reviews.map(row=>({...row,due:new Date(row.due),last_review:row.last_review ? new Date(row.last_review) : undefined})) as ReviewRecord[])
    await db.reviewLogs.bulkAdd(snapshot.reviewLogs.map(row=>({...row,log:{...row.log,due:new Date(row.log.due),review:new Date(row.log.review)}})) as SavedReviewLog[])
    await db.cloudMeta.put({id:'current',userId,revision,lastSyncAt:new Date().toISOString()})
    const oldBackups = await db.localBackups.orderBy('createdAt').reverse().offset(3).primaryKeys()
    await db.localBackups.bulkDelete(oldBackups)
  })
  useSettings.getState().update(snapshot.preferences)
}
export function exportSnapshot(snapshot: Snapshot) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}))
  const link = document.createElement('a'); link.href=url; link.download=`vocab-backup-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export async function uploadSnapshot(userId: string, expectedRevision: number) {
  return db.transaction('r', [...dataTables(), db.cloudMeta], async () => {
    const binding = await db.cloudMeta.get('current')
    if (binding?.userId && binding.userId !== userId) throw new Error('Local data belongs to another account')
    if ((binding?.userId === userId ? binding.revision : 0) !== expectedRevision) throw new Error('Local cloud binding changed')
    return localSnapshot()
  })
}
