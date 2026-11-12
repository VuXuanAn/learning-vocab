import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=stripTypeScriptTypes(readFileSync('src/lib/grammar-search.ts','utf8'))
const {searchGrammar}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
const row=(id,title,patch={})=>({id,title,structure:'S + V',usage:'',example:'',translation:'',notes:'',folderId:'tenses',updatedAt:'2026-11-12',...patch})
test('Grammar search matches titles without accents and excludes content and metadata',()=>{
 const entries=[row('present','Hiện tại đơn',{level:'A1',structures:[{id:2,type:'Phủ định',formula:'S + do/does + not + V'}],examples:[{id:1,en:'She drinks coffee.',vi:'Cô ấy uống cà phê.'}],usages:[{id:1,content:'Thói quen hằng ngày'}]})]
 for(const query of ['hien tai don','HIEN TAI','  hiện   tại  '])assert.equal(searchGrammar(entries,query)[0]?.id,'present',query)
 for(const query of ['phu dinh','does not','ca phe','thoi quen','cac thi','A1','S + V','past perfect'])assert.equal(searchGrammar(entries,query).length,0,query)
})
test('Exact and prefix names rank first, empty search shows recent records and input is not mutated',()=>{
 const entries=[row('content','Other',{usage:'present simple',updatedAt:'2026-11-15'}),row('prefix','Present simple passive'),row('exact','Present simple'),row('recent','Another',{updatedAt:'2026-11-16'})]
 assert.deepEqual(searchGrammar(entries,'present simple').map(row=>row.id),['exact','prefix'])
 assert.equal(searchGrammar(entries,'')[0].id,'recent')
 assert.equal(entries[0].id,'content')
})
