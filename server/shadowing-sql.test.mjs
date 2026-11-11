import test from 'node:test'
import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
test('shadowing SQL migration backfills recordings and enforces collaboration RLS',async()=>{
const db=new PGlite()
const owner='00000000-0000-0000-0000-000000000001',member='00000000-0000-0000-0000-000000000002',other='00000000-0000-0000-0000-000000000003'
const folder='20000000-0000-0000-0000-000000000001',lesson='30000000-0000-0000-0000-000000000001',recording='40000000-0000-0000-0000-000000000001'
async function actor(id){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`)}
try{
 await db.exec(`create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${owner}'),('${member}'),('${other}');`)
 await db.exec(readFileSync('supabase/migrations/007_speaking_recordings.sql','utf8'))
 await db.exec(`insert into speaking_recordings(id,user_id,title,reference_text,drive_file_id,mime_type,byte_size) values('10000000-0000-0000-0000-000000000001','${owner}','Legacy','Hello','legacy-file','audio/webm',5);`)
 const migration=readFileSync('supabase/migrations/008_shadowing_library.sql','utf8')
 await db.exec(migration)
 await db.exec(migration)
 await db.exec(readFileSync('supabase/migrations/009_speaking_ai_review.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/010_delete_speaking_recordings.sql','utf8'))
 assert.equal((await db.query('select count(*)::int as n from shadowing_lessons')).rows[0].n,1)
 assert.equal((await db.query('select lesson_id::text from speaking_recordings')).rows[0].lesson_id,'10000000-0000-0000-0000-000000000001')
 await actor(owner)
 await db.exec(`insert into shadowing_folders(id,owner_id,name) values('${folder}','${owner}','Work');insert into shadowing_lessons(id,owner_id,folder_id,title,reference_text) values('${lesson}','${owner}','${folder}','Read','Hello world');insert into speaking_recordings(id,user_id,lesson_id,title,drive_file_id,mime_type,byte_size) values('${recording}','${owner}','${lesson}','Read','new-file','audio/webm',5);insert into shadowing_folder_members(folder_id,user_id,role,added_by) values('${folder}','${member}','viewer','${owner}');`)
 await actor(member)
 assert.equal((await db.query("update speaking_recordings set ai_review='{}'::jsonb returning id")).rows.length,0)
 assert.equal((await db.query('select count(*)::int as n from shadowing_folders')).rows[0].n,1)
 assert.equal((await db.query('select count(*)::int as n from speaking_recordings')).rows[0].n,1)
 await assert.rejects(()=>db.exec(`insert into shadowing_comments(lesson_id,author_id,body) values('${lesson}','${member}','viewer cannot comment')`))
 await assert.rejects(()=>db.exec(`insert into shadowing_folder_members(folder_id,user_id,role,added_by) values('${folder}','${other}','reviewer','${member}')`))
 await actor(owner);await db.exec(`update shadowing_folder_members set role='reviewer' where folder_id='${folder}' and user_id='${member}'`)
 await actor(member)
 await db.exec(`insert into shadowing_comments(lesson_id,recording_id,author_id,body,audio_second) values('${lesson}','${recording}','${member}','Review this word',1.5);insert into shadowing_reviews(recording_id,reviewer_id,score,feedback) values('${recording}','${member}',80,'Good');`)
 assert.equal((await db.query(`update shadowing_lessons set title='Not allowed' where id='${lesson}' returning id`)).rows.length,0)
 assert.equal((await db.query(`delete from shadowing_lessons where id='${lesson}' returning id`)).rows.length,0)
 await assert.rejects(()=>db.query("select delete_shadowing_recording('40000000-0000-0000-0000-000000000001',false)"))
 await actor(other)
 for(const table of ['shadowing_folders','shadowing_lessons','speaking_recordings','shadowing_reviews','shadowing_comments'])assert.equal((await db.query(`select count(*)::int as n from ${table}`)).rows[0].n,0)
 await actor(owner);await db.exec(`delete from shadowing_folder_members where folder_id='${folder}' and user_id='${member}'`)
 await actor(member)
 assert.equal((await db.query('select count(*)::int as n from speaking_recordings')).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int as n from shadowing_comments')).rows[0].n,0)

 await actor(owner)
 await assert.rejects(()=>db.exec(`delete from shadowing_lessons where id='${lesson}'`))
 await db.query("select delete_shadowing_recording('40000000-0000-0000-0000-000000000001',true)")
 assert.equal((await db.query("select count(*)::int as n from speaking_recordings where id='40000000-0000-0000-0000-000000000001'")).rows[0].n,1)
 await db.query("select delete_shadowing_recording('40000000-0000-0000-0000-000000000001',false)")
 assert.equal((await db.query('select count(*)::int as n from shadowing_comments')).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int as n from shadowing_reviews')).rows[0].n,0)
 assert.equal((await db.query('select count(*)::int as n from speaking_recordings')).rows[0].n,1)
 await db.query("select delete_shadowing_recording('40000000-0000-0000-0000-000000000001',false)")
 await db.exec(`insert into shadowing_comments(lesson_id,author_id,body) values('${lesson}','${owner}','Lesson discussion')`)
 assert.equal((await db.query(`delete from shadowing_lessons where id='${lesson}' and owner_id='${owner}' returning id`)).rows.length,1)
 assert.equal((await db.query('select count(*)::int as n from shadowing_comments')).rows[0].n,0)
 assert.equal((await db.query(`select count(*)::int as n from shadowing_folders where id='${folder}'`)).rows[0].n,1)
 assert.equal((await db.query('select count(*)::int as n from speaking_recordings')).rows[0].n,1)
}finally{await db.close()}
})

