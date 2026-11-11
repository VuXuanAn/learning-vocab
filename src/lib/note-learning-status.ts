import type { ReviewRecord } from './review'
export type NoteLearningStatus='new'|'1'|'2'|'3'|'4'
export const learningStatusOptions:{value:NoteLearningStatus;label:string;color:string}[]=[
 {value:'new',label:'Chưa học',color:'bg-slate-100 text-slate-500'},
 {value:'1',label:'Quên',color:'bg-red-50 text-red-700'},
 {value:'2',label:'Khó',color:'bg-amber-50 text-amber-700'},
 {value:'3',label:'Tốt',color:'bg-emerald-50 text-emerald-700'},
 {value:'4',label:'Dễ',color:'bg-blue-50 text-blue-700'},
]
export function latestNoteRatings(records:Pick<ReviewRecord,'id'|'noteId'|'lastRating'|'last_review'>[]){
 const latest=new Map<string,{status:NoteLearningStatus;at:number;cardId:string}>()
 for(const row of records){
  const at=row.last_review?new Date(row.last_review).getTime():NaN
  if(!Number.isFinite(at)||![1,2,3,4].includes(row.lastRating))continue
  const previous=latest.get(row.noteId)
  if(!previous||at>previous.at||at===previous.at&&row.id.localeCompare(previous.cardId)>0)latest.set(row.noteId,{status:String(row.lastRating) as NoteLearningStatus,at,cardId:row.id})
 }
 return latest
}
export function validLearningFilter(value:string|null){return value==='all'||learningStatusOptions.some(option=>option.value===value)?value!:'all'}
