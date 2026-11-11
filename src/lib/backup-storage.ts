import { db, type VocabDatabase } from './db'
import { rowTables } from './row-codec'
import { folderIds, folderPath } from './folders'
import { useSettings } from './settings'
import { normalizePreferences } from './preferences'
import { parseBackup, type VocabularyBackup } from './backup-format'
import type { CardTemplate } from './templates'
import type { Note } from './cards'
import type { ReviewRecord } from './review'
import type { SavedReviewLog } from './review-storage'
export const BACKUP_MAX_BYTES=25*1024*1024
export async function exportBackup(folderId='all', account: VocabDatabase=db): Promise<VocabularyBackup> {
 const preferences=normalizePreferences(useSettings.getState())
 return account.transaction('r',rowTables.map(table=>account[table]),async()=>{
  const folders=await account.folders.toArray()
  const included=folderId==='all'?new Set(folders.map(folder=>folder.id)):folderIds(folderId,folders)
  if(folderId!=='all'&&!folders.some(folder=>folder.id===folderId))throw new Error('Thư mục không còn tồn tại.')
  const notes=(await account.notes.toArray()).filter(note=>folderId==='all'||included.has(note.folderId??''))
  const noteIds=new Set(notes.map(note=>note.id))
  if(folderId!=='all')for(const folder of folderPath(folderId,folders))included.add(folder.id)
  const result={format:'vocab-library-backup',version:1,createdAt:new Date().toISOString(),folders:folders.filter(folder=>included.has(folder.id)),templates:await account.templates.toArray(),notes,reviews:(await account.reviews.toArray()).filter(row=>noteIds.has(row.noteId)),reviewLogs:(await account.reviewLogs.toArray()).filter(row=>noteIds.has(row.noteId)),preferences}
  return parseBackup(JSON.parse(JSON.stringify(result)))
 })
}
export function downloadBackup(data: VocabularyBackup) {
 const content=JSON.stringify(data,null,2)
 if(new TextEncoder().encode(content).length>BACKUP_MAX_BYTES)throw new Error('File lớn hơn 25 MB. Hãy xuất riêng từng thư mục.')
 const url=URL.createObjectURL(new Blob([content],{type:'application/json'}))
 const link=document.createElement('a');link.href=url;link.download='vocab-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
export async function importBackup(raw:unknown, options:{progress:boolean;preferences:boolean}, account:VocabDatabase=db) {
 const data=parseBackup(raw)
 const rootId=crypto.randomUUID()
 const rootName='Nhập backup · '+new Date().toLocaleString('vi-VN')+' · '+rootId.slice(0,6)
 const folders=new Map(data.folders.map(row=>[row.id,crypto.randomUUID()]))
 const notes=new Map(data.notes.map(row=>[row.id,crypto.randomUUID()]))
 const templates=new Map(data.templates.map(row=>[row.id,crypto.randomUUID()]))
 const mapTemplate=(template:CardTemplate)=>{
  if(template.id==='builtin-ai-generator')return template
  if(!templates.has(template.id))templates.set(template.id,crypto.randomUUID())
  return {...template,id:templates.get(template.id)!}
 }
 const mapCard=(cardId:string,noteId:string)=>notes.get(noteId)!+cardId.slice(noteId.length)
 const importedFolders=data.folders.map(row=>({...row,id:folders.get(row.id)!,nameKey:row.name.toLocaleLowerCase('vi'),parentId:row.parentId?folders.get(row.parentId)!:rootId}))
 const importedNotes:Note[]=data.notes.map(row=>({...row,id:notes.get(row.id)!,folderId:folders.get(row.folderId)!,template:row.template?mapTemplate(row.template):undefined,values:row.values?Object.fromEntries(Object.entries(row.values).filter(([key,value])=>!key.startsWith('__relatedNote:')||notes.has(value)).map(([key,value])=>[key,key.startsWith('__relatedNote:')?notes.get(value)!:value])):undefined}))
 const importedReviews:ReviewRecord[]=options.progress?data.reviews.map(row=>({...row,id:mapCard(row.id,row.noteId),noteId:notes.get(row.noteId)!,due:new Date(row.due),last_review:row.last_review?new Date(row.last_review):undefined})):[]
 const importedLogs:SavedReviewLog[]=options.progress?data.reviewLogs.map(row=>({...row,id:crypto.randomUUID(),noteId:notes.get(row.noteId)!,cardId:mapCard(row.cardId,row.noteId),log:{...row.log,due:new Date(row.log.due),review:new Date(row.log.review)}})):[]
 await account.transaction('rw',account.tables,async()=>{
  await account.syncBackups.add({id:crypto.randomUUID(),createdAt:new Date().toISOString(),tables:Object.fromEntries(await Promise.all(rowTables.map(async table=>[table,await account[table].toArray()]))),bases:await account.syncRows.toArray()})
  await account.folders.add({id:rootId,name:rootName,nameKey:rootName.toLocaleLowerCase('vi'),createdAt:Date.now()})
  await account.folders.bulkAdd(importedFolders)
  await account.templates.bulkAdd(data.templates.map(row=>mapTemplate(row)))
  await account.notes.bulkAdd(importedNotes)
  await account.reviews.bulkAdd(importedReviews)
  await account.reviewLogs.bulkAdd(importedLogs)
  const old=await account.syncBackups.orderBy('createdAt').reverse().offset(3).primaryKeys()
  await account.syncBackups.bulkDelete(old)
 })
 if(options.preferences&&data.preferences)useSettings.getState().update(data.preferences)
 return {rootId,notes:importedNotes.length}
}
