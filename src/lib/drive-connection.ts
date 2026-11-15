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
interface DriveTokenCache { read: (userId:string)=>string; write: (userId:string,token:string)=>void; clear: (userId:string)=>void }
const tokenKey=(userId:string)=>'vocab-drive-session-v1:'+encodeURIComponent(userId)
const sessionTokens:DriveTokenCache={
 read(userId){try{return sessionStorage.getItem(tokenKey(userId))??''}catch{return ''}},
 write(userId,token){try{sessionStorage.setItem(tokenKey(userId),token)}catch{/* Drive still works in memory if session storage is unavailable. */}},
 clear(userId){try{sessionStorage.removeItem(tokenKey(userId))}catch{/* Storage may be unavailable. */}},
}
export function createDriveConnectionStore(check:(token:string)=>Promise<void>=checkDrive,history=memory,tokens:DriveTokenCache=sessionTokens){
 let identity='',generation=0,inflight:Promise<void>|undefined
 return create<DriveConnectionState>((set,get)=>({
  userId:'',accessToken:'',linked:false,ready:false,checking:false,error:disconnected,
  initialize(userId,token,force=false){
   const previous=get(),sameUser=previous.userId===userId
   const key=JSON.stringify([userId,token])
   if(key===identity&&!force)return inflight??Promise.resolve()
   if(sameUser&&!token&&previous.checking&&!force)return inflight??Promise.resolve()
   if(previous.userId&&!sameUser)tokens.clear(previous.userId)
   identity=key;const version=++generation
   const linked=!!userId&&(sameUser&&previous.linked||history.wasLinked(userId))
   // Supabase session refresh may omit its provider token. Keep our validated Drive
   // token in this app session; actual Drive failures still invalidate it.
   if(sameUser&&previous.ready&&previous.accessToken&&!token&&!force){inflight=undefined;set({checking:false});return Promise.resolve()}
   const candidate=token||(sameUser?previous.accessToken:'')||(userId?tokens.read(userId):'')
   const fallback=sameUser&&previous.ready?previous.accessToken:''
   if(!userId||!candidate){inflight=undefined;set({userId,accessToken:'',linked,ready:false,checking:false,error:disconnected});return Promise.resolve()}
   set({userId,accessToken:fallback,linked,ready:!!fallback,checking:true,error:fallback?'':'Đang kiểm tra quyền Drive…'})
   const job=Promise.resolve().then(()=>check(candidate)).then(()=>{
    if(version!==generation)return
    tokens.write(userId,candidate)
    history.rememberLinked(userId)
    set({accessToken:candidate,linked:true,ready:true,checking:false,error:''})
   }).catch(error=>{
    if(version!==generation)return
    const message=error instanceof Error?error.message:'Không kiểm tra được quyền Drive.'
    // A new login token without Drive scope must not replace the existing validated
    // token. Do not fall back for an expired token or any unrelated failure.
    if(fallback&&fallback!==candidate&&message.includes('[INSUFFICIENT_SCOPE]'))set({accessToken:fallback,ready:true,checking:false,error:''})
    else {tokens.clear(userId);set({accessToken:'',ready:false,checking:false,error:message})}
   }).finally(()=>{if(version===generation)inflight=undefined})
   inflight=job;return job
  },
  invalidate(message){if(get().userId)tokens.clear(get().userId);generation++;inflight=undefined;set({accessToken:'',ready:false,checking:false,error:message})},
  reset(){if(get().userId)tokens.clear(get().userId);identity='';generation++;inflight=undefined;set({userId:'',accessToken:'',linked:false,ready:false,checking:false,error:disconnected})},
 }))
}
// Keep validated access tokens only in this tab session, scoped to the account.
// Restore always checks Drive permission; readiness is never persisted.
export const useDriveConnection=createDriveConnectionStore()
