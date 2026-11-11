import { db, type VocabDatabase } from './db'
export interface CachedVocabulary {key:string;text:string;createdAt:number}
export const cacheWordKey=(text:string)=>text.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('en')
export async function addCachedWord(text:string,account:VocabDatabase=db){
 const clean=text.trim().replace(/\s+/gu,' '),key=cacheWordKey(clean)
 if(!key||clean.length>200)throw new Error('Mỗi từ hoặc cụm từ tối đa 200 ký tự.')
 return account.transaction('rw',account.vocabularyCache,async()=>{
  if(await account.vocabularyCache.get(key))return false
  await account.vocabularyCache.add({key,text:clean,createdAt:Date.now()});return true
 })
}
export function fillCachedWords(current:string[],cached:CachedVocabulary[],limit=20){
 const seen=new Set(current.map(cacheWordKey)),words=[...current]
 for(const entry of cached){if(words.length>=limit)break;const key=cacheWordKey(entry.text);if(seen.has(key))continue;seen.add(key);words.push(entry.text)}
 return {words,added:words.length-current.length}
}
export async function removeCachedWords(words:string[],account:VocabDatabase=db){await account.vocabularyCache.bulkDelete([...new Set(words.map(cacheWordKey))])}
