import { create } from 'zustand'
import { checkDrive } from './google-drive'
interface DriveConnectionState {
 userId:string
 accessToken:string
 linked:boolean
 ready:boolean
 checking:boolean
 error:string
 initialize:(userId:string,token:string,force?:boolean)=>Promise<void>
 invalidate:(message:string)=>void
 reset:()=>void
}
const disconnected='Phiên hiện tại chưa có quyền truy cập Drive. Hãy kết nối lại trong Cài đặt.'
const marker=(userId:string)=>'vocab-drive-linked-v1:'+encodeURIComponent(userId)
const memory={
 wasLinked(userId:string){try{return localStorage.getItem(marker(userId))==='true'}catch{return false}},
 rememberLinked(userId:string){try{localStorage.setItem(marker(userId),'true')}catch{/* Status hint is optional. */}},
}
export function createDriveConnectionStore(check:(token:string)=>Promise<void>=checkDrive,history=memory){
 let identity='',generation=0,inflight:Promise<void>|undefined
 return create<DriveConnectionState>((set,get)=>({
  userId:'',accessToken:'',linked:false,ready:false,checking:false,error:disconnected,
  initialize(userId,token,force=false){
   const previous=get(),sameUser=previous.userId===userId
   const key=JSON.stringify([userId,token])
   if(key===identity&&!force)return inflight??Promise.resolve()
   if(sameUser&&!token&&previous.checking&&!force)return inflight??Promise.resolve()
   identity=key;const version=++generation
   const linked=!!userId&&(sameUser&&previous.linked||history.wasLinked(userId))
   // Supabase session refresh may omit its provider token. Keep our validated Drive
   // token in this app session; actual Drive failures still invalidate it.
   if(sameUser&&previous.ready&&previous.accessToken&&!token&&!force){inflight=undefined;set({checking:false});return Promise.resolve()}
   const candidate=token||(sameUser?previous.accessToken:'')
   const fallback=sameUser&&previous.ready?previous.accessToken:''
   if(!userId||!candidate){inflight=undefined;set({userId,accessToken:'',linked,ready:false,checking:false,error:disconnected});return Promise.resolve()}
   set({userId,accessToken:fallback,linked,ready:!!fallback,checking:true,error:fallback?'':'Đang kiểm tra quyền Drive…'})
   const job=Promise.resolve().then(()=>check(candidate)).then(()=>{
    if(version!==generation)return
    history.rememberLinked(userId)
    set({accessToken:candidate,linked:true,ready:true,checking:false,error:''})
   }).catch(error=>{
    if(version!==generation)return
    const message=error instanceof Error?error.message:'Không kiểm tra được quyền Drive.'
    // A new login token without Drive scope must not replace the existing validated
    // token. Do not fall back for an expired token or any unrelated failure.
    if(fallback&&fallback!==candidate&&message.includes('[INSUFFICIENT_SCOPE]'))set({accessToken:fallback,ready:true,checking:false,error:''})
    else set({accessToken:'',ready:false,checking:false,error:message})
   }).finally(()=>{if(version===generation)inflight=undefined})
   inflight=job;return job
  },
  invalidate(message){generation++;inflight=undefined;set({accessToken:'',ready:false,checking:false,error:message})},
  reset(){identity='';generation++;inflight=undefined;set({userId:'',accessToken:'',linked:false,ready:false,checking:false,error:disconnected})},
 }))
}
// Only the per-account "linked before" hint is persisted, never a ready flag or
// Google access token. Permission is checked once for the current app session.
export const useDriveConnection=createDriveConnectionStore()
