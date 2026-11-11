import { useEffect, type ReactNode } from 'react'
import { liveQuery } from 'dexie'
import { useAuth } from './AuthProvider'
import { db } from './db'
import { createRowTransport } from './row-transport'
import { syncRowCycle, readLocalRows, hasPendingRows, restoreSyncBackup } from './row-sync'
import { createAutoRowSync } from './auto-row-sync'
import { rowTables, encodeRow, stable } from './row-codec'
import { rowSyncErrorMessage } from './row-sync-error'
import { useVocabularySyncState } from './vocabulary-sync-state'
import { supabase } from './supabase'
export default function VocabularySyncProvider({ children }: { children: ReactNode }) {
 const { session }=useAuth()
 const userId=session?.user.id
 const status=useVocabularySyncState(state=>state.status)
 useEffect(()=>{
  if(!supabase||!userId)return
  const account=db
  const transport=createRowTransport(supabase,userId)
  const sync=createAutoRowSync({
   online:()=>navigator.onLine!==false,
   status:next=>useVocabularySyncState.setState({status:next}),
   cycle:(mode,active)=>{
    const cycle=()=>syncRowCycle(account,transport,active,mode)
    return navigator.locks?navigator.locks.request('vocab-rows-'+userId,cycle):cycle()
   },
  })
  useVocabularySyncState.setState({ready:true,status:{phase:'idle'},pending:false,sync:(mode='merge')=>sync.request(mode),restore:async()=>{
   const restore=()=>restoreSyncBackup(account)
   if(navigator.locks)await navigator.locks.request('vocab-rows-'+userId,restore)
   else await restore()
   sync.changed()
  }})
  let lastFingerprint=''
  const subscription=liveQuery(async()=>{
   const [local,meta,backups]=await Promise.all([readLocalRows(account),account.syncMeta.get('current'),account.syncBackups.count()])
   return {pending:hasPendingRows(local),firstSync:!meta,lastSyncAt:meta?.lastSyncAt,canRestore:backups>0,
    fingerprint:stable(rowTables.map(table=>[table,[...local.tables[table].values()].map(row=>[row.id,encodeRow(table,row)])]))}
  }).subscribe({
   next:({fingerprint,...state})=>{
    useVocabularySyncState.setState(state)
    if(state.pending&&fingerprint!==lastFingerprint)sync.changed()
    lastFingerprint=fingerprint
   },
   error:error=>useVocabularySyncState.setState({status:{phase:'error',error}}),
  })
  const refresh=()=>sync.request('merge')
  const visibility=()=>sync.request('merge')
  window.addEventListener('online',refresh)
  window.addEventListener('focus',refresh)
  window.addEventListener('pagehide',refresh)
  document.addEventListener('visibilitychange',visibility)
  refresh()
  return()=>{
   subscription.unsubscribe();sync.stop()
   window.removeEventListener('online',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('pagehide',refresh);document.removeEventListener('visibilitychange',visibility)
   useVocabularySyncState.setState({ready:false,status:{phase:'idle'},pending:false,firstSync:true,lastSyncAt:undefined,canRestore:false,sync:()=>{},restore:async()=>{}})
  }
 },[userId])
 return <>{status.phase==='error'&&<p role="alert" className="workspace-sync-alert shrink-0 px-6 py-2 text-sm text-amber-700">{rowSyncErrorMessage(status.error)}</p>}{children}</>
}
