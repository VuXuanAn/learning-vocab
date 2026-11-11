import { db, type VocabDatabase } from './db'
import type { ShadowingFolder, ShadowingLesson } from './shadowing-types'
export async function saveShadowingFolder(ownerId:string,name:string,id?:string,account:VocabDatabase=db){
 const clean=name.trim();if(!ownerId||!clean||clean.length>100)throw new Error('Tên thư mục cần từ 1 đến 100 ký tự.')
 return account.transaction('rw',account.shadowingFolders,async()=>{
  const existing=id?await account.shadowingFolders.get(id):undefined
  if(id&&(!existing||existing.ownerId!==ownerId))throw new Error('Không có quyền sửa thư mục.')
  const nameKey=clean.toLocaleLowerCase('vi')
  if(await account.shadowingFolders.filter(row=>row.nameKey===nameKey&&row.id!==id).count())throw new Error('Tên thư mục đã tồn tại.')
  const row:ShadowingFolder={id:id??crypto.randomUUID(),ownerId,name:clean,nameKey,createdAt:existing?.createdAt??new Date().toISOString(),metadataSynced:false}
  await account.shadowingFolders.put(row);return row
 })
}
export async function saveShadowingLesson(row:ShadowingLesson,account:VocabDatabase=db){
 if(!row.title.trim()||row.title.trim().length>160||!row.referenceText.trim()||row.referenceText.length>12000)throw new Error('Điền tên bài (tối đa 160 ký tự) và đoạn văn (tối đa 12.000 ký tự).')
 return account.transaction('rw',account.shadowingFolders,account.shadowingLessons,account.speakingRecordings,async()=>{
  const folder=await account.shadowingFolders.get(row.folderId)
  if(!folder||folder.ownerId!==row.ownerId)throw new Error('Hãy chọn thư mục của bạn trước khi lưu bài.')
  const previous=await account.shadowingLessons.get(row.id)
  if(previous&&previous.ownerId!==row.ownerId)throw new Error('Không có quyền sửa bài.')
  const next={...row,title:row.title.trim(),referenceText:row.referenceText.trim(),updatedAt:new Date().toISOString(),metadataSynced:false}
  await account.shadowingLessons.put(next);return next
 })
}
export function lessonForRecording(row:{id:string;lessonId?:string;title:string;referenceText:string;createdAt:string},lessons:ShadowingLesson[],ownerId:string):ShadowingLesson{
 return lessons.find(lesson=>lesson.id===(row.lessonId??row.id))??{id:row.lessonId??row.id,ownerId,folderId:'',title:row.title,referenceText:row.referenceText,createdAt:row.createdAt,updatedAt:row.createdAt}
}
