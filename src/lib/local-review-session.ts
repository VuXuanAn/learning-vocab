export type LocalReviewSession={ids:string[];total:number;attempts:number;directions:Record<string,boolean>;currentId?:string}
export function reviewSessionKey(account:string,folder:string){return 'review-session-v1:'+JSON.stringify([account,folder])}
export function readReviewSession(storage:Pick<Storage,'getItem'>,key:string):LocalReviewSession|null{
 try{
  const value=JSON.parse(storage.getItem(key)??'null')
  if(!value||!Array.isArray(value.ids)||!value.ids.every((id:unknown)=>typeof id==='string')||new Set(value.ids).size!==value.ids.length||!Number.isSafeInteger(value.total)||value.total<value.ids.length||!Number.isSafeInteger(value.attempts)||value.attempts<0||!value.directions||typeof value.directions!=='object'||Array.isArray(value.directions)||!Object.values(value.directions).every(v=>typeof v==='boolean')||(value.currentId!==undefined&&typeof value.currentId!=='string'))return null
  return value
 }catch{return null}
}
export function writeReviewSession(storage:Pick<Storage,'setItem'|'removeItem'>,key:string,session:LocalReviewSession|null){
 if(session)storage.setItem(key,JSON.stringify(session));else storage.removeItem(key)
}
