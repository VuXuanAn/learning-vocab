import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { supabase } from './supabase'
import { readingArticleSchema, readingFolderSchema, readingStudyNoteSchema } from './reading-storage'
export function useReadingLibrary(ownerId:string){
 const allFolders=useLiveQuery(()=>db.readingFolders.toArray())??[]
 const allArticles=useLiveQuery(()=>db.readingArticles.toArray())??[]
 const [error,setError]=useState(''),[syncing,setSyncing]=useState(false)
 const queue=useRef<Promise<void>>(Promise.resolve())
 async function perform(){
  if(!supabase||!ownerId)return
  const client=supabase;setSyncing(true)
  try{
   const tables=[{local:db.readingFolders,remote:'reading_folders',schema:readingFolderSchema},{local:db.readingArticles,remote:'reading_articles',schema:readingArticleSchema},{local:db.readingStudyNotes,remote:'reading_study_notes',schema:readingStudyNoteSchema}] as const
   for(const config of tables){
    const pending=await config.local.filter(row=>!row.metadataSynced).toArray()
    for(const row of pending){
     const {metadataSynced,...data}=row;void metadataSynced
     const payload={id:row.id,owner_id:ownerId,updated_at:row.updatedAt,deleted_at:row.deletedAt??null,data,...('folderId' in row?{folder_id:row.folderId}:{}),...('articleId' in row?{article_id:row.articleId,note_type:row.type}:{})}
     const result=await client.from(config.remote).upsert(payload,{onConflict:'id'})
     if(result.error)throw result.error
     await db.transaction('rw',config.local,async()=>{const current=await config.local.get(row.id);if(current&&JSON.stringify(current)===JSON.stringify(row))await config.local.update(row.id,{metadataSynced:true})})
    }
   }
   for(const config of tables){
    for(let offset=0;;offset+=500){
     const result=await client.from(config.remote).select('*').eq('owner_id',ownerId).order('id').range(offset,offset+499)
     if(result.error)throw result.error
     await db.transaction('rw',config.local,async()=>{
      for(const remote of result.data??[]){
       const parsed=config.schema.safeParse({...remote.data,id:remote.id,ownerId:remote.owner_id,updatedAt:remote.updated_at,deletedAt:remote.deleted_at??undefined,metadataSynced:true,...(remote.folder_id?{folderId:remote.folder_id}:{}),...(remote.article_id?{articleId:remote.article_id,type:remote.note_type}:{})})
       if(!parsed.success)continue
       const current=await config.local.get(remote.id)
       if(current&&!current.metadataSynced)continue
       // The discriminated table/schema pairs above validate cloud data before storage.
       await (config.local as typeof db.readingFolders).put(parsed.data as never)
      }
     })
     if((result.data?.length??0)<500)break
    }
   }
   setError('')
  }catch(error){const code=(error as {code?:string})?.code;setError(['42P01','PGRST205'].includes(code??'')?'Chạy migration 011 và 012_reading_study_notes.sql trong Supabase để đồng bộ Reading. Dữ liệu vẫn được lưu trên máy.':'Chưa đồng bộ được Reading. Dữ liệu trên máy vẫn được giữ; bấm Làm mới để thử lại.');throw error}
  finally{setSyncing(false)}
 }
 function sync(){const work=queue.current.catch(()=>{}).then(()=>navigator.locks?navigator.locks.request('vocab-reading-'+ownerId,perform):perform());queue.current=work;return work}
 useEffect(()=>{void sync().catch(()=>{});const retry=()=>void sync().catch(()=>{});window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry)},[ownerId])
 return {folders:allFolders.filter(row=>!row.deletedAt),articles:allArticles.filter(row=>!row.deletedAt).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),sync,syncing,error}
}
