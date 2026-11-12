import { readingSourceKey, sourcesForArticle } from './reading-sources'
﻿import { z } from 'zod'
import { db, type VocabDatabase } from './db'
import type { ReadingArticle, ReadingFolder, ReadingStudyNote, ReadingMatch } from './reading-types'
const base={id:z.string().uuid(),ownerId:z.string().min(1),createdAt:z.string(),updatedAt:z.string(),deletedAt:z.string().optional(),metadataSynced:z.boolean().optional()}
export const readingStudyNoteSchema=z.object({...base,articleId:z.string().uuid(),type:z.enum(['grammar','sentence_structure','expression','other']),title:z.string().trim().min(1).max(160),content:z.string().trim().min(1).max(50000),sourceQuote:z.string().max(10000).default('')})
export const readingFolderSchema=z.object({...base,name:z.string().trim().min(1).max(100)})
export const readingArticleSchema=z.object({...base,folderId:z.string().uuid(),title:z.string().trim().min(1).max(160),contentHtml:z.string().max(200000),note:z.string().max(50000),translation:z.object({text:z.string().trim().min(1).max(1000000),sourceHtml:z.string().max(200000),createdAt:z.string()}).optional(),detection:z.object({html:z.string().max(200000),createdAt:z.string(),matches:z.array(z.object({start:z.number().int().min(0),end:z.number().int().min(0),noteId:z.string(),word:z.string().max(200),confirmed:z.boolean().optional(),context:z.string().max(1000).optional()})).max(20000)}).optional()})
export async function saveReadingFolder(row:ReadingFolder,account:VocabDatabase=db){
 const parsed=readingFolderSchema.parse({...row,name:row.name.trim(),updatedAt:new Date().toISOString(),metadataSynced:false})
 await account.transaction('rw',account.readingFolders,async()=>{
  const previous=await account.readingFolders.get(row.id)
  if(previous&&previous.ownerId!==row.ownerId)throw new Error('Không có quyền sửa thư mục.')
  if(await account.readingFolders.filter(folder=>!folder.deletedAt&&folder.id!==row.id&&folder.name.toLocaleLowerCase('vi')===parsed.name.toLocaleLowerCase('vi')).count())throw new Error('Tên thư mục đã tồn tại.')
  await account.readingFolders.put(parsed)
 });return parsed
}
export async function saveReadingArticle(row:ReadingArticle,account:VocabDatabase=db){
 const parsed=readingArticleSchema.parse({...row,title:row.title.trim(),updatedAt:new Date().toISOString(),metadataSynced:false})
 await account.transaction('rw',[account.readingFolders,account.readingArticles,account.readingStudyNotes,account.notes,account.folders],async()=>{
  const folder=await account.readingFolders.get(row.folderId),previous=await account.readingArticles.get(row.id)
  if(!folder||folder.deletedAt||folder.ownerId!==row.ownerId||previous&&previous.ownerId!==row.ownerId)throw new Error('Hãy chọn thư mục Reading của bạn.')
  if(previous?.contentHtml!==parsed.contentHtml)parsed.detection=undefined
  if(parsed.translation?.sourceHtml!==parsed.contentHtml)parsed.translation=undefined
  const sources=sourcesForArticle(parsed),key=readingSourceKey(parsed.id)
  const affected=new Set([...(previous?.detection?.matches.map(match=>match.noteId)??[]),...sources.keys()])
  for(const note of await account.notes.bulkGet([...affected])){
   if(!note||note.readOnly)continue
   const folder=note.folderId?await account.folders.get(note.folderId):undefined
   if(folder?.permission==='viewer')continue
   const values={...note.values},source=sources.get(note.id)
   if(source)values[key]=JSON.stringify(source);else delete values[key]
   if(JSON.stringify(values)!==JSON.stringify(note.values??{}))await account.notes.update(note.id,{values})
  }
  await account.readingArticles.put(parsed)
  if(parsed.deletedAt)await account.readingStudyNotes.where('articleId').equals(parsed.id).filter(note=>!note.deletedAt).modify({deletedAt:parsed.deletedAt,updatedAt:parsed.updatedAt,metadataSynced:false})
 });return parsed
}

export async function saveReadingStudyNote(row:ReadingStudyNote,account:VocabDatabase=db){
 const parsed=readingStudyNoteSchema.parse({...row,updatedAt:new Date().toISOString(),metadataSynced:false})
 await account.transaction('rw',account.readingArticles,account.readingStudyNotes,async()=>{
  const article=await account.readingArticles.get(row.articleId),previous=await account.readingStudyNotes.get(row.id)
  if(!article||article.deletedAt||article.ownerId!==row.ownerId||previous&&(previous.ownerId!==row.ownerId||previous.articleId!==row.articleId))throw new Error('Không có quyền lưu ghi chú vào bài đọc này.')
  if(previous&&previous.updatedAt!==row.updatedAt)throw new Error('Ghi chú đã thay đổi. Hãy mở lại trước khi lưu.')
  await account.readingStudyNotes.put(parsed)
 });return parsed
}

export async function saveReadingTranslation(id:string,ownerId:string,sourceHtml:string,text:string,account:VocabDatabase=db,expectedText?:string){
 return account.transaction('rw',[account.readingFolders,account.readingArticles,account.readingStudyNotes,account.notes,account.folders],async()=>{
  const current=await account.readingArticles.get(id)
  if(!current||current.deletedAt||current.ownerId!==ownerId)throw new Error('Không có quyền lưu bản dịch vào bài đọc này.')
  if(current.contentHtml!==sourceHtml)throw new Error('Nội dung bài đã thay đổi. Hãy dịch lại.')
  if(expectedText!==undefined&&current.translation?.text!==expectedText)throw new Error('Bản dịch đã thay đổi. Hãy hủy và mở lại phần chỉnh sửa.')
  return saveReadingArticle({...current,translation:{text,sourceHtml,createdAt:new Date().toISOString()}},account)
 })
}

export async function editReadingTranslation(article:ReadingArticle,text:string,account:VocabDatabase=db){
 if(!article.translation)throw new Error('Bài đọc chưa có bản dịch để chỉnh sửa.')
 return saveReadingTranslation(article.id,article.ownerId,article.contentHtml,text,account,article.translation.text)
}

export async function confirmReadingMatches(articleId:string,ownerId:string,base:{html:string;matches:ReadingMatch[];createdAt:string},confirmed:ReadingMatch[],account:VocabDatabase=db){
 return account.transaction('rw',[account.readingFolders,account.readingArticles,account.readingStudyNotes,account.notes,account.folders],async()=>{
  const current=await account.readingArticles.get(articleId)
  if(!current||current.deletedAt||current.ownerId!==ownerId)throw new Error('Không có quyền lưu kết quả vào bài đọc này.')
  if(!current.detection||current.detection.html!==base.html||current.detection.createdAt!==base.createdAt||JSON.stringify(current.detection.matches)!==JSON.stringify(base.matches))throw new Error('Kết quả dò đã thay đổi. Hãy đóng và Detect vocab lại.')
  const notes=await account.notes.bulkGet([...new Set(confirmed.map(match=>match.noteId))])
  if(notes.some(note=>!note))throw new Error('Một thẻ từ vựng đã bị xóa. Hãy dò lại.')
  const matches=[...base.matches,...confirmed.map(match=>({...match,confirmed:true}))].sort((a,b)=>a.start-b.start)
  if(matches.some((match,index)=>match.start<0||match.end<=match.start||index>0&&matches[index-1].end>match.start))throw new Error('Các vị trí xác nhận bị chồng lấn. Hãy dò lại.')
  return saveReadingArticle({...current,detection:{html:base.html,matches,createdAt:new Date().toISOString()}},account)
 })
}
