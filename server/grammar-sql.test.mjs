import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
test('Grammar SQL reruns, enforces owner isolation and changes timestamps on edits',async()=>{
 const db=new PGlite(),a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',folder='10000000-0000-0000-0000-000000000001',entry='20000000-0000-0000-0000-000000000001'
 const actor=id=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`)
 try{
  await db.exec(`create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${a}'),('${b}');`)
  const sql=readFileSync('supabase/migrations/013_grammar_library.sql','utf8');await db.exec(sql);await db.exec(sql)
  await actor(a)
  await db.exec(`insert into grammar_folders(id,owner_id,data) values('${folder}','${a}','{}');insert into grammar_entries(id,owner_id,folder_id,data,updated_at) values('${entry}','${a}','${folder}','{}','2000-01-01')`)
  await db.exec(`update grammar_entries set data='{"notes":"saved"}' where id='${entry}'`)
  const saved=(await db.query('select * from grammar_entries')).rows[0]
  assert.equal(saved.data.notes,'saved');assert.ok(new Date(saved.updated_at).getUTCFullYear()>2000)
  await actor(b)
  assert.equal((await db.query('select * from grammar_entries')).rows.length,0)
  assert.equal((await db.query('select * from grammar_folders')).rows.length,0)
  assert.equal((await db.query("update grammar_entries set data='{}' returning id")).rows.length,0)
  await assert.rejects(()=>db.exec(`insert into grammar_entries(id,owner_id,folder_id,data) values(gen_random_uuid(),'${b}','${folder}','{}')`))
  await assert.rejects(()=>db.exec(`insert into grammar_folders(id,owner_id,data) values(gen_random_uuid(),'${a}','{}')`))
 }finally{await db.close()}
})
