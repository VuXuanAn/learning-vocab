export function sortGrammarItems<T extends {id:string;createdAt:string;sortOrder?:number}>(rows:T[],newestFirst=false):T[] {
 return [...rows].sort((a,b)=>{
  const orderA=Number.isFinite(a.sortOrder)?a.sortOrder!:Number.MAX_SAFE_INTEGER
  const orderB=Number.isFinite(b.sortOrder)?b.sortOrder!:Number.MAX_SAFE_INTEGER
  return orderA-orderB||(newestFirst?b.createdAt.localeCompare(a.createdAt):a.createdAt.localeCompare(b.createdAt))
 })
}
