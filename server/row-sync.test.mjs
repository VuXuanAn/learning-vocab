import 'fake-indexeddb/auto'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
const read = name => readFileSync(new URL('../src/lib/' + name + '.ts', import.meta.url), 'utf8')
const url = source => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64')
const codecUrl = url(read('row-codec'))
const errorUrl = url(read('row-sync-error'))
const transportUrl = url(read('row-transport').replace("'./row-codec'", JSON.stringify(codecUrl)).replace("'./row-sync-error'", JSON.stringify(errorUrl)))
const reviewUrl = url(read('review').replace("'ts-fsrs'", JSON.stringify(import.meta.resolve('ts-fsrs'))))
const syncUrl = url(read('row-sync').replace("'./row-codec'", JSON.stringify(codecUrl)).replace("'./row-transport'", JSON.stringify(transportUrl)).replace("'./review'", JSON.stringify(reviewUrl)))
const dbUrl = url(read('db').replace("'dexie'", JSON.stringify(import.meta.resolve('dexie'))))
const { VocabDatabase } = await import(dbUrl)
const { syncRowCycle, createRowSync, hasPendingRows, readLocalRows, restoreSyncBackup } = await import(syncUrl)
const { rowTables, sqlTables, localId } = await import(codecUrl)
const { nextReview } = await import(reviewUrl)
const { createRowTransport } = await import(transportUrl)
const folder = (id = 'f', parentId = '') => ({ id, name: id, nameKey: id, parentId, createdAt: 1 })
const note = (id = 'n', folderId = 'f') => ({ id, folderId, kind: 'basic', front: 'word', back: 'meaning', extra: '', tags: '', createdAt: 1 })
function fixture() {
 const db = new VocabDatabase('row-test-' + crypto.randomUUID())
 const cloud = Object.fromEntries(rowTables.map(table => [table, new Map()]))
 let clock = 0, offline = false
 const writes = []
 const timestamp = () => new Date(++clock * 1000).toISOString()
 const transport = {
  load: async table => { if (offline) throw new Error('offline'); return structuredClone([...cloud[table].values()]) },
  write: async (table, id, value, remote) => {
   if (offline) throw new Error('offline')
   writes.push({table,id,value})
   const row = {id,owner_id:'a',permission:'owner',created_at:timestamp(),...remote,...(value ?? {deleted_at:timestamp()}),updated_at:timestamp()}
   cloud[table].set(id,row);return row
  },
  review: async (value, expected, logs) => {
   const id = value.note_id + '-' + value.card_key
   assert.equal(Number(cloud.reviews.get(id)?.review_revision ?? 0), expected)
   const row = {...value,user_id:'a',updated_at:timestamp()}
   cloud.reviews.set(id,row)
   for(const log of logs) cloud.reviewLogs.set(log.id,{...log,user_id:'a',updated_at:timestamp()})
   writes.push({table:'reviews',id,value,logs});return row
  },
 }
 return {db,cloud,transport,writes,cycle:mode=>syncRowCycle(db,transport,()=>true,mode),setOffline:value=>{offline=value}}
}

test('Grammar uploads existing local data, restores reading sources on another device and propagates edits and deletion',async()=>{
 const f=fixture(),other=new VocabDatabase('grammar-device-'+crypto.randomUUID())
 const now=new Date().toISOString()
 const folder={id:'gf',ownerId:'a',name:'Grammar',nameKey:'grammar',parentId:'parent',createdAt:now,updatedAt:now}
 const entry={id:'ge',ownerId:'a',folderId:'gf',title:'Conditional',topic:'',structure:'If …',usage:'Line one\nLine two',example:'',translation:'',notes:'Keep',status:'review',createdAt:now,updatedAt:now,sources:[{articleId:'article',contentHtml:'<p>If I were you</p>',quote:'If I were you',start:0,end:13,highlights:[{start:0,end:2}]}]}
 try{
  await f.db.grammarFolders.put(folder);await f.db.grammarEntries.put(entry)
  await f.cycle()
  assert.deepEqual(f.writes.map(row=>row.table),['grammarFolders','grammarEntries'])
  await syncRowCycle(other,f.transport)
  assert.deepEqual(await other.grammarEntries.get('ge'),entry)
  assert.deepEqual(await other.grammarFolders.get('gf'),folder)
  await f.db.grammarEntries.update('ge',{notes:'Edited'})
  await f.cycle();await syncRowCycle(other,f.transport)
  assert.equal((await other.grammarEntries.get('ge')).notes,'Edited')
  await f.db.grammarEntries.delete('ge');await f.cycle();await syncRowCycle(other,f.transport)
  assert.equal(await other.grammarEntries.count(),0)
  assert.ok(f.cloud.grammarEntries.get('ge').deleted_at)
 }finally{await f.db.delete();await other.delete()}
})
test('Grammar-only sync preserves pending vocabulary and its sync acknowledgements',async()=>{
 const f=fixture(),tables=['grammarFolders','grammarEntries'],now=new Date().toISOString()
 try{
  await f.db.folders.put(folder());await f.db.notes.put(note());await f.cycle()
  const bases=await f.db.syncRows.toArray()
  await f.db.notes.update('n',{front:'Pending vocabulary'})
  await f.db.grammarFolders.put({id:'gf',ownerId:'a',name:'Grammar',nameKey:'grammar',createdAt:now,updatedAt:now})
  f.writes.length=0
  await syncRowCycle(f.db,f.transport,()=>true,'merge',tables)
  assert.deepEqual(f.writes.map(row=>row.table),['grammarFolders'])
  assert.equal((await f.db.notes.get('n')).front,'Pending vocabulary')
  for(const base of bases)assert.deepEqual(await f.db.syncRows.get(base.key),base)
  assert.ok(await f.db.syncMeta.get('grammar-auto'))
  await f.db.grammarFolders.delete('gf')
  await syncRowCycle(f.db,f.transport,()=>true,'merge',tables)
  assert.ok(f.cloud.grammarFolders.get('gf').deleted_at)
 }finally{await f.db.delete()}
})

test('adds parent folders first, uploads individual notes, edits and soft deletes only changed rows',async()=>{
 const f=fixture()
 try{
  await f.db.folders.bulkAdd([folder('a-child','z-parent'),folder('z-parent')])
  await f.db.notes.add(note('n','a-child'))
  await f.cycle()
  assert.deepEqual(f.writes.map(x=>x.id),['z-parent','a-child','n'])
  await f.db.notes.update('n',{front:'edited'})
  await f.cycle()
  assert.deepEqual(f.writes.at(-1).value,{front:'edited'})
  assert.equal(f.writes.length,4)
  await f.db.notes.delete('n');await f.cycle()
  assert.ok(f.cloud.notes.get('n').deleted_at)
  assert.equal(await f.db.notes.count(),0)
  await f.cycle();assert.equal(f.writes.length,5)
 }finally{await f.db.delete()}
})
test('offline edits and deletions survive reopening the cache',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder());await f.db.notes.add(note());await f.cycle()
  f.setOffline(true);await f.db.notes.delete('n');await assert.rejects(f.cycle(),/offline/)
  f.db.close();await f.db.open();f.setOffline(false);await f.cycle()
  assert.ok(f.cloud.notes.get('n').deleted_at)
 }finally{await f.db.delete()}
})
test('downloads shared data, merges independent field edits and applies revoked access',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder());await f.db.notes.add(note());await f.cycle()
  await f.db.notes.update('n',{front:'local front'})
  f.cloud.notes.set('n',{...f.cloud.notes.get('n'),back:'remote back',updated_at:'2026-01-01T00:00:00Z'})
  await f.cycle()
  assert.equal((await f.db.notes.get('n')).front,'local front')
  assert.equal((await f.db.notes.get('n')).back,'remote back')
  await f.db.notes.update('n',{front:'pending'})
  f.cloud.folders.clear();f.cloud.notes.clear();await f.cycle()
  assert.equal(await f.db.notes.count(),0)
  assert.equal(await f.db.folders.count(),0)
 }finally{await f.db.delete()}
})
test('edits made during upload remain pending and are sent next',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder());await f.db.notes.add(note());await f.cycle()
  await f.db.notes.update('n',{front:'first'})
  const original=f.transport.write
  f.transport.write=async(...args)=>{const result=await original(...args);await f.db.notes.update('n',{front:'second'});return result}
  await f.cycle()
  assert.equal((await f.db.notes.get('n')).front,'second')
  assert.equal(f.cloud.notes.get('n').front,'first')
  f.transport.write=original;await f.cycle()
  assert.equal(f.cloud.notes.get('n').front,'second')
 }finally{await f.db.delete()}
})
test('atomic review upload restores Dates and uses per-card progress keys',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder());await f.db.notes.add(note());await f.cycle()
  const now=new Date('2026-11-10T00:00:00Z'), result=nextReview(undefined,3,now)
  await f.db.transaction('rw',f.db.reviews,f.db.reviewLogs,async()=>{
   await f.db.reviews.put({...result.card,id:'n-forward',noteId:'n',lastRating:3,revision:1})
   await f.db.reviewLogs.add({id:'log',noteId:'n',cardId:'n-forward',log:result.log})
  })
  await f.cycle()
  assert.equal(f.cloud.reviews.get('n-forward').card_key,'forward')
  assert.equal(f.cloud.reviewLogs.get('log').note_id,'n')
  assert.ok((await f.db.reviews.get('n-forward')).due instanceof Date)
  assert.ok((await f.db.reviewLogs.get('log')).log.review instanceof Date)
  await f.cycle();assert.equal(f.writes.filter(x=>x.table==='reviews').length,1)
 }finally{await f.db.delete()}
})
test('row transport paginates metadata, fetches only changed content, never calls a snapshot endpoint',async()=>{
 const rows=Array.from({length:501},(_,i)=>({id:String(i).padStart(4,'0'),updated_at:'1',folder_id:'f',kind:'basic',front:'word'}))
 const calls=[]
 const client={from:name=>{
  assert.equal(name,'notes');let columns,ids
  const q={select:value=>{columns=value;return q},order:()=>q,eq:()=>q,in:(_c,value)=>{ids=value;return q},range:async(a,b)=>{calls.push({columns,range:[a,b]});return {data:rows.slice(a,b+1)}},then:resolve=>{calls.push({columns,ids});return Promise.resolve({data:rows.filter(r=>ids.includes(r.id))}).then(resolve)}};return q
 }}
 const t=createRowTransport(client,'a')
 const first=await t.load('notes',[])
 assert.equal(first.length,501)
 assert.equal(calls.filter(x=>x.range).length,2)
 assert.equal(calls.filter(x=>x.ids).length,6)
 calls.length=0
 await t.load('notes',first.map(r=>({key:'notes:'+r.id,id:r.id,table:'notes',remote:r,value:{}})))
 assert.equal(calls.filter(x=>x.ids).length,0)
 assert.equal(sqlTables.notes,'notes');assert.equal(localId('reviews',{note_id:'n',card_key:'reverse'}),'n-reverse')
})
test('stopped controller does not report a late success',async()=>{
 let release,status
 const sync=createRowSync({status:s=>{status=s},cycle:()=>new Promise(done=>{release=done})})
 sync.retry()
 while(!release) await new Promise(done=>setTimeout(done,1))
 sync.stop();release();await new Promise(done=>setTimeout(done,5))
 assert.notEqual(status.phase,'saved')
})
test('remote deletion removes cached progress and logs without recreating the note',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder());await f.db.notes.add(note());await f.cycle()
  f.cloud.notes.set('n',{...f.cloud.notes.get('n'),deleted_at:new Date().toISOString(),updated_at:'later'})
  await f.cycle();await f.cycle()
  assert.equal(await f.db.notes.count(),0)
  assert.equal(f.writes.filter(x=>x.table==='notes').length,1)
 }finally{await f.db.delete()}
})
test('a review made on another device is rebased before sending newer offline grades',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder());await f.db.notes.add(note());await f.cycle()
  const first=nextReview(undefined,3,new Date('2026-01-01T00:00:00Z'))
  await f.db.reviews.put({...first.card,id:'n-forward',noteId:'n',revision:1,lastRating:3})
  await f.db.reviewLogs.put({id:'first',noteId:'n',cardId:'n-forward',log:first.log})
  await f.cycle()
  const local=nextReview(await f.db.reviews.get('n-forward'),2,new Date('2026-01-03T00:00:00Z'))
  await f.db.reviews.put({...local.card,id:'n-forward',noteId:'n',revision:2,lastRating:2})
  await f.db.reviewLogs.put({id:'offline',noteId:'n',cardId:'n-forward',log:local.log})
  const server=f.cloud.reviews.get('n-forward')
  server.review_revision=2;server.fsrs.last_review='2026-01-02T00:00:00Z'
  await f.cycle()
  assert.equal(f.cloud.reviews.get('n-forward').review_revision,3)
  assert.equal(f.cloud.reviews.get('n-forward').last_rating,2)
  assert.equal(f.writes.at(-1).logs.length,1)
 }finally{await f.db.delete()}
})

test('folder insert permission failure preserves its context and identifies the SQL patch',async()=>{
 const client={from:()=>({insert:()=>({select:()=>({maybeSingle:async()=>({error:{code:'42501',message:'new row violates row-level security policy for table "folders"'}})})})})}
 const transport=createRowTransport(client,'a')
 const {rowSyncErrorMessage}=await import(errorUrl)
 await assert.rejects(()=>transport.write('folders','id',{name:'Folder',parent_id:null,reverse_cards:false}),error=>{
  assert.equal(error.code,'42501')
  assert.equal(error.table,'folders')
  assert.equal(error.operation,'insert')
  assert.match(rowSyncErrorMessage(error),/006_fix_folder_insert_rls.sql/)
  return true
 })
})
test('manual controller stays idle until clicked, prevents overlapping requests and never retries automatically',async()=>{
 let calls=0,status,release
 const sync=createRowSync({status:next=>{status=next},cycle:async()=>{calls++;await new Promise(done=>{release=done});throw new Error('offline')}})
 await new Promise(done=>setTimeout(done,10))
 assert.equal(calls,0)
 sync.retry();sync.retry()
 assert.equal(calls,1)
 release();await new Promise(done=>setTimeout(done,5))
 assert.equal(status.phase,'error')
 await new Promise(done=>setTimeout(done,10));assert.equal(calls,1)
 sync.stop()
})
test('pending indicator tracks persisted local additions, edits, deletions and in-flight edits',async()=>{
 const f=fixture()
 try{
  assert.equal(hasPendingRows(await readLocalRows(f.db)),false)
  await f.db.folders.add(folder());await f.db.notes.add(note())
  assert.equal(hasPendingRows(await readLocalRows(f.db)),true)
  await f.cycle();assert.equal(hasPendingRows(await readLocalRows(f.db)),false)
  await f.db.notes.update('n',{front:'changed'})
  assert.equal(hasPendingRows(await readLocalRows(f.db)),true)
  await f.cycle();assert.equal(hasPendingRows(await readLocalRows(f.db)),false)
  await f.db.notes.delete('n')
  f.db.close();await f.db.open()
  assert.equal(hasPendingRows(await readLocalRows(f.db)),true)
  await f.cycle();assert.equal(hasPendingRows(await readLocalRows(f.db)),false)
 }finally{await f.db.delete()}
})
test('upload sends local data without downloading or deleting cloud-only records',async()=>{
 const f=fixture()
 try{
  f.cloud.folders.set('remote',{id:'remote',name:'Remote',owner_id:'a',permission:'owner',created_at:'2026-01-01T00:00:00Z',updated_at:'1'})
  await f.db.folders.add(folder());await f.db.notes.add(note())
  await f.cycle('upload')
  assert.ok(f.cloud.notes.has('n'))
  assert.ok(f.cloud.folders.has('remote'))
  assert.equal(await f.db.folders.get('remote'),undefined)
  assert.equal(hasPendingRows(await readLocalRows(f.db)),false)
  assert.equal((await f.db.syncMeta.get('current')).mode,'upload')
  await f.cycle('merge')
  assert.equal((await f.db.folders.get('remote')).name,'Remote')
 }finally{await f.db.delete()}
})
test('download replaces local data without uploads and retains a restorable local backup',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder());await f.db.notes.add(note());await f.cycle()
  await f.db.notes.update('n',{front:'unsent local'})
  await f.db.notes.add(note('local-only'))
  f.cloud.notes.set('n',{...f.cloud.notes.get('n'),front:'server version',updated_at:'new'})
  const writes=f.writes.length
  await f.cycle('download')
  assert.equal(f.writes.length,writes)
  assert.equal((await f.db.notes.get('n')).front,'server version')
  assert.equal(await f.db.notes.get('local-only'),undefined)
  assert.equal(await f.db.syncBackups.count(),1)
  assert.equal(hasPendingRows(await readLocalRows(f.db)),false)
  await restoreSyncBackup(f.db)
  assert.equal((await f.db.notes.get('n')).front,'unsent local')
  assert.ok(await f.db.notes.get('local-only'))
  assert.equal(hasPendingRows(await readLocalRows(f.db)),true)
 }finally{await f.db.delete()}
})
test('upload acknowledges local field edits without masking later cloud changes',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder());await f.db.notes.add(note());await f.cycle()
  await f.db.notes.update('n',{front:'local edit'})
  f.cloud.notes.set('n',{...f.cloud.notes.get('n'),back:'server edit',updated_at:'new'})
  await f.cycle('upload')
  assert.equal((await f.db.notes.get('n')).back,'meaning')
  assert.equal(f.cloud.notes.get('n').front,'local edit')
  assert.equal(f.cloud.notes.get('n').back,'server edit')
  assert.equal(hasPendingRows(await readLocalRows(f.db)),false)
  await f.cycle('merge')
  assert.equal((await f.db.notes.get('n')).back,'server edit')
  assert.equal(f.cloud.notes.get('n').back,'server edit')
 }finally{await f.db.delete()}
})
test('failed download does not replace local data, and concurrent edits cancel replacement',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder());await f.db.notes.add(note());await f.cycle()
  f.setOffline(true);await assert.rejects(f.cycle('download'),/offline/)
  assert.equal((await f.db.notes.get('n')).front,'word')
  assert.equal(await f.db.syncBackups.count(),0)
  f.setOffline(false)
  const original=f.transport.load
  f.transport.load=async(...args)=>{const data=await original(...args);if(args[0]==='notes')await f.db.notes.update('n',{front:'typed during download'});return data}
  await assert.rejects(f.cycle('download'),error=>error.code==='LOCAL_CHANGED_DURING_DOWNLOAD')
  assert.equal((await f.db.notes.get('n')).front,'typed during download')
  assert.equal(hasPendingRows(await readLocalRows(f.db)),true)
  assert.equal(await f.db.syncBackups.count(),0)
 }finally{await f.db.delete()}
})
test('reviews after an upload-only conflict continue advancing server revisions',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder());await f.db.notes.add(note());await f.cycle()
  const first=nextReview(undefined,3,new Date('2026-01-01T00:00:00Z'))
  await f.db.reviews.put({...first.card,id:'n-forward',noteId:'n',revision:1,lastRating:3})
  await f.db.reviewLogs.put({id:'first',noteId:'n',cardId:'n-forward',log:first.log});await f.cycle()
  const local=nextReview(await f.db.reviews.get('n-forward'),2,new Date('2026-01-03T00:00:00Z'))
  await f.db.reviews.put({...local.card,id:'n-forward',noteId:'n',revision:2,lastRating:2})
  await f.db.reviewLogs.put({id:'offline',noteId:'n',cardId:'n-forward',log:local.log})
  f.cloud.reviews.get('n-forward').review_revision=2
  f.cloud.reviews.get('n-forward').fsrs.last_review='2026-01-02T00:00:00Z'
  await f.cycle('upload')
  assert.equal(f.cloud.reviews.get('n-forward').review_revision,3)
  const next=nextReview(await f.db.reviews.get('n-forward'),3,new Date('2026-01-05T00:00:00Z'))
  await f.db.reviews.put({...next.card,id:'n-forward',noteId:'n',revision:3,lastRating:3})
  await f.db.reviewLogs.put({id:'next',noteId:'n',cardId:'n-forward',log:next.log})
  await f.cycle('upload')
  assert.equal(f.cloud.reviews.get('n-forward').review_revision,4)
  assert.equal(hasPendingRows(await readLocalRows(f.db)),false)
 }finally{await f.db.delete()}
})

test('new folders and their notes created during a merge remain pending instead of being treated as revoked',async()=>{
 const f=fixture()
 try{
  const original=f.transport.load
  f.transport.load=async(...args)=>{
   const data=await original(...args)
   if(args[0]==='notes'){
    await f.db.folders.add(folder('during'))
    await f.db.notes.add(note('during-note','during'))
   }
   return data
  }
  await f.cycle('merge')
  assert.ok(await f.db.folders.get('during'))
  assert.ok(await f.db.notes.get('during-note'))
  assert.equal(hasPendingRows(await readLocalRows(f.db)),true)
 }finally{await f.db.delete()}
})

test('restored schedules without history bootstrap to cloud without fabricating review events',async()=>{
 const f=fixture()
 try{
  await f.db.folders.add(folder())
  await f.db.notes.add(note())
  const result=nextReview(undefined,3,new Date('2026-11-11T00:00:00Z'))
  await f.db.reviews.add({...result.card,id:'n-forward',noteId:'n',lastRating:3,revision:7})
  await f.cycle()
  assert.equal(f.cloud.reviews.get('n-forward').review_revision,7)
  assert.equal(f.cloud.reviews.get('n-forward').due,result.card.due.toISOString())
  assert.equal(f.cloud.reviewLogs.size,0)
  assert.deepEqual(f.writes.find(row=>row.table==='reviews').logs,[])
  const count=f.writes.length
  await f.cycle()
  assert.equal(f.writes.length,count)
 }finally{await f.db.delete()}
})

test('transport bootstraps imported personal progress directly when no historical logs exist',async()=>{
 let captured
 const client={from:table=>{assert.equal(table,'user_card_progress');return {insert:value=>{captured=value;return {select:()=>({single:async()=>({data:{...value,updated_at:'2026-11-11T00:00:00Z'},error:null})})}}}}}
 const transport=createRowTransport(client,'owner-a')
 const result=await transport.review({note_id:'n',card_key:'forward',due:'2026-12-01T00:00:00Z',fsrs:{state:2},last_rating:3,review_revision:7},0,[])
 assert.equal(captured.user_id,'owner-a')
 assert.equal(result.review_revision,7)
})
