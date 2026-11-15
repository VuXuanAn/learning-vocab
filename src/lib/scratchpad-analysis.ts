export const sentenceRoles=[
 {id:'subject',label:'Chủ ngữ',short:'S',color:'border-blue-200 bg-blue-50 text-blue-800'},
 {id:'verb',label:'Động từ',short:'V',color:'border-emerald-200 bg-emerald-50 text-emerald-800'},
 {id:'object',label:'Tân ngữ',short:'O',color:'border-amber-200 bg-amber-50 text-amber-800'},
 {id:'complement',label:'Bổ ngữ',short:'C',color:'border-violet-200 bg-violet-50 text-violet-800'},
 {id:'adverbial',label:'Trạng ngữ',short:'A',color:'border-rose-200 bg-rose-50 text-rose-800'},
 {id:'modifier',label:'Định ngữ',short:'Mod',color:'border-cyan-200 bg-cyan-50 text-cyan-800'},
 {id:'connector',label:'Liên kết',short:'Link',color:'border-slate-200 bg-slate-100 text-slate-700'},
] as const
export const wordTypes=[
 {id:'noun',label:'Danh từ',short:'N'}, {id:'verb',label:'Động từ',short:'V'},
 {id:'adjective',label:'Tính từ',short:'Adj'}, {id:'adverb',label:'Trạng từ',short:'Adv'},
 {id:'pronoun',label:'Đại từ',short:'Pron'}, {id:'determiner',label:'Từ hạn định / Mạo từ',short:'Det'},
 {id:'preposition',label:'Giới từ',short:'Prep'}, {id:'conjunction',label:'Liên từ',short:'Conj'},
 {id:'auxiliary',label:'Trợ động từ',short:'Aux'}, {id:'particle',label:'Tiểu từ',short:'Part'},
 {id:'number',label:'Số từ',short:'Num'}, {id:'interjection',label:'Thán từ',short:'Int'},
] as const
export interface WordAnnotation {role?:string;wordType?:string;note?:string}
export interface SentenceWord {id:string;text:string;start:number;end:number;after:string}
export function sentenceWords(quote:string):SentenceWord[]{
 const words=[...quote.matchAll(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:['’-][\p{L}\p{N}][\p{L}\p{M}\p{N}]*)*/gu)]
 return words.map((match,index)=>({id:String(match.index),text:match[0],start:match.index,end:match.index+match[0].length,after:quote.slice(match.index+match[0].length,words[index+1]?.index??quote.length)}))
}
export function normalizeWordAnnotations(quote:string,value:unknown,groups:WordGroup[]=[]):Record<string,WordAnnotation>{
 if(!value||typeof value!=='object'||Array.isArray(value))return {}
 const saved=value as Record<string,WordAnnotation|null>,result:Record<string,WordAnnotation>={}
 for(const word of [...sentenceWords(quote),...sentenceTags(quote,groups).filter(tag=>tag.wordIds.length>1)]){
  const row=saved[word.id]
  if(!row||typeof row!=='object')continue
  const role=sentenceRoles.some(option=>option.id===row.role)?row.role:undefined
  const wordType=wordTypes.some(option=>option.id===row.wordType)?row.wordType:undefined
  const note=typeof row.note==='string'?row.note.slice(0,2000):undefined
  if(role||wordType||note)result[word.id]={role,wordType,note}
 }
 return result
}
export function sentenceAnalysisText(quote:string,annotations:Record<string,WordAnnotation>,groups:WordGroup[]=[]){
 const lines=sentenceTags(quote,groups).flatMap(word=>{
  const annotation=annotations[word.id]
  if(!annotation)return []
  const role=sentenceRoles.find(option=>option.id===annotation.role)
  const type=wordTypes.find(option=>option.id===annotation.wordType)
  const labels=[role?`${role.short} · ${role.label}`:'',type?.label,annotation.note].filter(Boolean)
  return labels.length?[`${word.text}: ${labels.join(' · ')}`]:[]
 })
 return [quote,...(lines.length?['',...lines]:[])].join('\n')
}

export interface WordGroup {start:number;end:number}
export interface SentenceTag extends SentenceWord {wordIds:string[]}
export const wordGroupId=(group:WordGroup)=>'group:'+group.start+':'+group.end
export function normalizeWordGroups(quote:string,value:unknown):WordGroup[]{
 if(!Array.isArray(value))return []
 const words=sentenceWords(quote),result:WordGroup[]=[]
 for(const group of [...value].sort((a,b)=>(a?.start??0)-(b?.start??0))){
  if(!group||!Number.isInteger(group.start)||!Number.isInteger(group.end))continue
  const first=words.findIndex(word=>word.start===group.start),last=words.findIndex(word=>word.end===group.end)
  if(first<0||last<=first||result.some(saved=>group.start<saved.end))continue
  result.push({start:group.start,end:group.end})
 }
 return result
}
export function sentenceTags(quote:string,groups:WordGroup[]=[]):SentenceTag[]{
 const words=sentenceWords(quote),normalized=normalizeWordGroups(quote,groups),tags:SentenceTag[]=[]
 for(let index=0;index<words.length;index++){
  const word=words[index],group=normalized.find(group=>group.start===word.start)
  if(!group){tags.push({...word,wordIds:[word.id]});continue}
  const members=words.filter(word=>word.start>=group.start&&word.end<=group.end)
  tags.push({id:wordGroupId(group),text:quote.slice(group.start,group.end),start:group.start,end:group.end,after:members.at(-1)!.after,wordIds:members.map(word=>word.id)})
  index+=members.length-1
 }
 return tags
}
export function mergeSentenceTags(quote:string,groups:WordGroup[],annotations:Record<string,WordAnnotation>,ids:Set<string>){
 const tags=sentenceTags(quote,groups),indices=tags.flatMap((tag,index)=>ids.has(tag.id)?[index]:[])
 if(indices.length<2||indices.at(-1)!-indices[0]+1!==indices.length)return null
 const selected=indices.map(index=>tags[index]),group={start:selected[0].start,end:selected.at(-1)!.end},id=wordGroupId(group)
 const first=annotations[selected[0].id]??{}
 const shared:WordAnnotation={
  role:selected.every(tag=>annotations[tag.id]?.role===first.role)?first.role:undefined,
  wordType:selected.every(tag=>annotations[tag.id]?.wordType===first.wordType)?first.wordType:undefined,
  note:[...new Set(selected.filter(tag=>tag.wordIds.length>1).map(tag=>annotations[tag.id]?.note).filter(Boolean))].join('\n')||undefined,
 }
 const next={...annotations}
 for(const tag of selected)if(tag.wordIds.length>1)delete next[tag.id]
 if(shared.role||shared.wordType||shared.note)next[id]=shared
 return {id,annotations:next,groups:[...groups.filter(saved=>saved.end<=group.start||saved.start>=group.end),group].sort((a,b)=>a.start-b.start)}
}
export function splitSentenceTag(quote:string,groups:WordGroup[],annotations:Record<string,WordAnnotation>,id:string){
 const tag=sentenceTags(quote,groups).find(tag=>tag.id===id)
 if(!tag||tag.wordIds.length<2)return null
 const next={...annotations},note=next[id]?.note
 if(note){const first=tag.wordIds[0],existing=next[first]??{};next[first]={...existing,note:[existing.note,note].filter(Boolean).join('\n')}}
 delete next[id]
 return {groups:groups.filter(group=>wordGroupId(group)!==id),annotations:next,ids:tag.wordIds}
}
