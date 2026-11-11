import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=stripTypeScriptTypes(readFileSync(new URL('../src/lib/supabase-config.ts',import.meta.url),'utf8'))
const {publicSupabaseConfig}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
test('public config accepts publishable/anon keys but rejects privileged secrets',()=>{
 assert.equal(publicSupabaseConfig().error,'')
 assert.equal(publicSupabaseConfig('https://project.supabase.co','sb_publishable_example').error,'')
 const jwt=role=>'header.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature'
 assert.equal(publicSupabaseConfig('https://project.supabase.co',jwt('anon')).error,'')
 for(const key of ['sb_secret_example',jwt('service_role'),'not-a-key'])assert.ok(publicSupabaseConfig('https://project.supabase.co',key).error)
 assert.ok(publicSupabaseConfig('https://bad','sb_secret_secret').error)
 assert.ok(publicSupabaseConfig('http://project.supabase.co','sb_publishable_example').error)
})
