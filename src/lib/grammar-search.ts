import type { GrammarEntry } from './grammar-types'

const normalize=(value:string)=>value.toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/\s+/g,' ').trim()
export function searchGrammar(entries:GrammarEntry[],query:string) {
 const term=normalize(query),tokens=term.split(' ').filter(Boolean)
 const rank=(entry:GrammarEntry)=>{const title=normalize(entry.name??entry.title);return title===term?0:title.startsWith(term)?1:title.includes(term)?2:3}
 return entries.filter(entry=>{
  const title=normalize(entry.name??entry.title)
  return tokens.every(token=>title.includes(token))
 }).sort((a,b)=>(term?rank(a)-rank(b):0)||b.updatedAt.localeCompare(a.updatedAt)||a.title.localeCompare(b.title,'vi'))
}
