import { create } from 'zustand'
import { checkDrive } from './google-drive'
interface DriveConnectionState {
 ready:boolean
 checking:boolean
 error:string
 initialize:(userId:string,token:string,force?:boolean)=>Promise<void>
 invalidate:(message:string)=>void
 reset:()=>void
}
const disconnected='Phiên hiện tại chưa có quyền truy cập Drive. Hãy kết nối lại trong Cài đặt.'
export function createDriveConnectionStore(check:(token:string)=>Promise<void>=checkDrive){
 let identity='',generation=0,inflight:Promise<void>|undefined
 return create<DriveConnectionState>((set)=>({
  ready:false,checking:false,error:disconnected,
  initialize(userId,token,force=false){
   const key=JSON.stringify([userId,token])
   if(key===identity&&!force)return inflight??Promise.resolve()
   identity=key;const version=++generation
   if(!userId||!token){inflight=undefined;set({ready:false,checking:false,error:disconnected});return Promise.resolve()}
   set({ready:false,checking:true,error:'Đang kiểm tra quyền Drive…'})
   const job=Promise.resolve().then(()=>check(token)).then(()=>{
    if(version===generation)set({ready:true,checking:false,error:''})
   }).catch(error=>{
    if(version===generation)set({ready:false,checking:false,error:error instanceof Error?error.message:'Không kiểm tra được quyền Drive.'})
   }).finally(()=>{if(version===generation)inflight=undefined})
   inflight=job;return job
  },
  invalidate(message){generation++;inflight=undefined;set({ready:false,checking:false,error:message})},
  reset(){identity='';generation++;inflight=undefined;set({ready:false,checking:false,error:disconnected})},
 }))
}
// Memory only: do not persist Google tokens or cache authorization across app reloads.
export const useDriveConnection=createDriveConnectionStore()
