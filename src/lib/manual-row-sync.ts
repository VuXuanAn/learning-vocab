import type { RowSyncMode, RowSyncStatus } from './row-sync'
export function createManualRowSync(options:{online:()=>boolean;status:(status:RowSyncStatus)=>void;cycle:(mode:RowSyncMode,active:()=>boolean)=>Promise<void>}){
 let stopped=false,running=false
 return {
  async request(mode:RowSyncMode='merge'){
   if(stopped||running)return
   if(!options.online()){options.status({phase:'error',error:{code:'OFFLINE'}});return}
   running=true;options.status({phase:'syncing'})
   try{await options.cycle(mode,()=>!stopped);if(!stopped)options.status({phase:'saved'})}
   catch(error){if(!stopped)options.status({phase:'error',error})}
   finally{running=false}
  },
  stop(){stopped=true},
 }
}
