import type { WordAnnotation, WordGroup } from './scratchpad-analysis'
export interface ScratchpadDraft { html:string; updatedAt:string; annotations?:Record<string,WordAnnotation>; groups?:WordGroup[] }
const draftKey=(ownerId:string,path:string,quote:string)=>'vocab-scratchpad-v1:'+JSON.stringify([ownerId,path,quote])
export function loadScratchpad(ownerId:string,path:string,quote:string,storage:Pick<Storage,'getItem'>=localStorage):ScratchpadDraft|null{
 const value=storage.getItem(draftKey(ownerId,path,quote))
 if(!value)return null
 try{
  const draft=JSON.parse(value)
  return typeof draft?.html==='string'&&typeof draft?.updatedAt==='string'?{html:draft.html,updatedAt:draft.updatedAt,groups:Array.isArray(draft.groups)?draft.groups:[],annotations:draft.annotations&&typeof draft.annotations==='object'&&!Array.isArray(draft.annotations)?draft.annotations:{}}:null
 }catch{return null}
}
export function saveScratchpad(ownerId:string,path:string,quote:string,html:string,storage:Pick<Storage,'setItem'>=localStorage,annotations:Record<string,WordAnnotation>={},groups:WordGroup[]=[]){
 const draft:ScratchpadDraft={html,updatedAt:new Date().toISOString(),annotations,groups}
 storage.setItem(draftKey(ownerId,path,quote),JSON.stringify(draft))
 return draft
}
