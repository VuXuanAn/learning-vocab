import type { RowSyncMode, RowSyncStatus } from './row-sync'
export function createAutoRowSync(options: {
 cycle: (mode: RowSyncMode, active: () => boolean) => Promise<void>
 status: (status: RowSyncStatus) => void
 online: () => boolean
 debounceMs?: number
 retryMs?: number
}) {
 let stopped=false,running=false
 let queued:RowSyncMode|undefined
 let timer:ReturnType<typeof setTimeout>|undefined
 let failures=0
 function schedule(delay:number){clearTimeout(timer);timer=setTimeout(()=>void run(),delay)}
 async function run(){
  if(stopped||running||!queued)return
  const mode=queued;queued=undefined
  if(!options.online()){
   queued='merge';options.status({phase:'error',error:{code:'OFFLINE'}});return
  }
  running=true
  options.status({phase:'syncing'})
  let failed=false
  try{
   await options.cycle(mode,()=>!stopped)
   failures=0
   if(!stopped)options.status({phase:'saved'})
  }catch(error){
   failed=true;failures++
   if(!stopped){options.status({phase:'error',error});queued='merge'}
  }finally{
   running=false
   if(!stopped&&queued)schedule(failed?Math.min((options.retryMs??10000)*2**Math.min(failures-1,3),60000):0)
  }
 }
 return {
  request(mode:RowSyncMode='merge',delay=0){
   if(stopped)return
   // Automatic merge requests cannot replace an explicitly queued direction.
   if(!queued||mode!=='merge')queued=mode
   if(!running){if(delay===0){clearTimeout(timer);void run()}else schedule(delay)}
  },
  changed(){this.request('merge',options.debounceMs??800)},
  stop(){stopped=true;clearTimeout(timer);queued=undefined},
 }
}
