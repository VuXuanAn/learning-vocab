import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { supabase } from './supabase'
import type { ShadowingLesson } from './shadowing-types'
export function useShadowingLibrary(ownerId:string){
 const folders=useLiveQuery(()=>db.shadowingFolders.orderBy('createdAt').toArray())??[]
 const lessons=useLiveQuery(()=>db.shadowingLessons.orderBy('createdAt').reverse().toArray())??[]
 const [error,setError]=useState('')
 const queue=useRef<Promise<void>>(Promise.resolve())
 async function performSync(){
  if(!supabase||!ownerId)return
  try{
   for(const row of await db.shadowingFolders.filter(row=>!row.metadataSynced).toArray()){
    const {error}=await supabase.from('shadowing_folders').upsert({id:row.id,owner_id:ownerId,name:row.name,created_at:row.createdAt},{onConflict:'id'})
    if(error)throw error
    await db.transaction('rw',db.shadowingFolders,async()=>{const current=await db.shadowingFolders.get(row.id);if(current?.name===row.name)await db.shadowingFolders.update(row.id,{metadataSynced:true})})
   }
   for(const row of await db.shadowingLessons.filter(row=>!row.metadataSynced).toArray()){
    const {error}=await supabase.from('shadowing_lessons').upsert({id:row.id,owner_id:ownerId,folder_id:row.folderId,title:row.title,reference_text:row.referenceText,created_at:row.createdAt,updated_at:row.updatedAt},{onConflict:'id'})
    if(error)throw error
    await db.transaction('rw',db.shadowingLessons,async()=>{const current=await db.shadowingLessons.get(row.id);if(current?.updatedAt===row.updatedAt&&current.folderId===row.folderId&&current.title===row.title&&current.referenceText===row.referenceText)await db.shadowingLessons.update(row.id,{metadataSynced:true})})
   }
   const [folderResponse,lessonResponse]=await Promise.all([supabase.from('shadowing_folders').select('*').eq('owner_id',ownerId),supabase.from('shadowing_lessons').select('*').eq('owner_id',ownerId)])
   if(folderResponse.error)throw folderResponse.error;if(lessonResponse.error)throw lessonResponse.error
   await db.transaction('rw',db.shadowingFolders,db.shadowingLessons,async()=>{
    for(const row of folderResponse.data??[]){const local=await db.shadowingFolders.get(row.id);if(local&&!local.metadataSynced)continue;await db.shadowingFolders.put({id:row.id,ownerId:row.owner_id,name:row.name,nameKey:row.name.toLocaleLowerCase('vi'),createdAt:row.created_at,metadataSynced:true})}
    for(const row of lessonResponse.data??[]){const local=await db.shadowingLessons.get(row.id);if(local&&!local.metadataSynced)continue;await db.shadowingLessons.put({id:row.id,ownerId:row.owner_id,folderId:row.folder_id,title:row.title,referenceText:row.reference_text,createdAt:row.created_at,updatedAt:row.updated_at,metadataSynced:true})}
   })
   setError('')
  }catch(error){
    const code=(error as {code?:string})?.code
    setError(['42P01','PGRST205','42703'].includes(code??'')?'Cần chạy migration 008_shadowing_library.sql trên Supabase. Folder/bài học đã được giữ trên máy.':code==='23505'?'Tên folder đã tồn tại trên cloud. Hãy đổi tên rồi làm mới để đồng bộ lại.':code==='42501'?'Chưa có quyền cập nhật folder/bài học trên cloud. Bản trên máy vẫn được giữ.':'Chưa đồng bộ được folder/bài học. Dữ liệu được giữ trên máy; kiểm tra mạng và bấm Làm mới để thử lại.')
    throw error
   }
 }
 function exclusive(work:()=>Promise<void>){const job=queue.current.catch(()=>{}).then(()=>navigator.locks?navigator.locks.request('vocab-shadowing-'+ownerId,work):work());queue.current=job;return job}
 function sync(){return exclusive(performSync)}
 useEffect(()=>{void sync().catch(()=>{});const retry=()=>{void sync().catch(()=>{})};window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry)},[ownerId])
 async function ensureLesson(row:ShadowingLesson){await db.shadowingLessons.put(row);await sync()}
 return {folders,lessons,error,sync,ensureLesson,exclusive}
}
