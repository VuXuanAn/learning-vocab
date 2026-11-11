import { z } from 'zod'
import { generateCards, type Note } from './cards'
import { validateTemplate } from './templates'
const text = z.string().max(200000)
const id = z.string().min(1).max(300)
const date = z.string().refine(value => Number.isFinite(Date.parse(value)), 'Ngày không hợp lệ')
const field = z.object({id,name:text,required:z.boolean()})
const template = z.object({id,name:text,fields:z.array(field).min(1).max(100),frontTemplate:text,backTemplate:text,format:z.enum(['html','text']).optional(),css:text.optional(),align:z.enum(['left','center','right']),fontSize:z.number().min(14).max(48),color:text,speech:z.object({fieldId:id,lang:text,rate:z.number().min(.5).max(1.5)}).optional()})
const fsrs = {due:date,stability:z.number().nonnegative(),difficulty:z.number().nonnegative(),elapsed_days:z.number().nonnegative(),scheduled_days:z.number().nonnegative(),learning_steps:z.number().int().nonnegative(),reps:z.number().int().nonnegative(),lapses:z.number().int().nonnegative(),state:z.number().int().min(0).max(3),last_review:date.optional()}
const schema = z.object({
 format:z.literal('vocab-library-backup').optional(),version:z.literal(1),createdAt:date,
 folders:z.array(z.object({id,name:text,nameKey:text.optional(),createdAt:z.number().nonnegative(),parentId:z.string().optional(),reverseCards:z.boolean().optional()})).max(100000),
 templates:z.array(template).max(100000),
 notes:z.array(z.object({id,kind:z.enum(['basic','reverse','cloze','custom','ai']),front:text,back:text,extra:text,tags:text,folderId:id,createdAt:z.number().nonnegative(),template:template.optional(),values:z.record(z.string(),text).optional()})).max(100000),
 reviews:z.array(z.object({...fsrs,id,noteId:id,lastRating:z.number().int().min(1).max(4),revision:z.number().int().positive()})).max(100000),
 reviewLogs:z.array(z.object({id,noteId:id,cardId:id,log:z.object({due:date,review:date,rating:z.number().int().min(1).max(4),state:z.number().int().min(0).max(3),stability:z.number().nonnegative(),difficulty:z.number().nonnegative(),elapsed_days:z.number().nonnegative(),last_elapsed_days:z.number().nonnegative(),scheduled_days:z.number().nonnegative(),learning_steps:z.number().int().nonnegative()})})).max(100000),
 preferences:z.object({reminderEnabled:z.boolean(),reminderMinutes:z.number().int().min(1).max(120),autoVoice:z.boolean()}).optional(),
})
export type VocabularyBackup = z.infer<typeof schema>
export function parseBackup(raw: unknown): VocabularyBackup {
 const data=schema.parse(raw)
 for(const rows of [data.folders,data.templates,data.notes,data.reviews,data.reviewLogs])if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('File có ID trùng lặp.')
 const folders=new Map(data.folders.map(folder=>[folder.id,folder]))
 for(const folder of data.folders){
  const seen=new Set<string>([folder.id]);let parent=folder.parentId
  while(parent){if(seen.has(parent)||!folders.has(parent))throw new Error('Cấu trúc thư mục không hợp lệ.');seen.add(parent);parent=folders.get(parent)?.parentId}
 }
 const cards=new Map<string,Set<string>>()
 for(const item of data.templates){const error=validateTemplate(item);if(error)throw new Error('Mẫu thẻ không hợp lệ: '+error)}
 for(const note of data.notes){
  if(!folders.has(note.folderId))throw new Error('Từ vựng tham chiếu thư mục không tồn tại.')
  if((note.kind==='custom'||note.kind==='ai')&&!note.template)throw new Error('Thiếu mẫu cho thẻ AI/tùy chỉnh.')
  if(note.template){const error=validateTemplate(note.template);if(error)throw new Error(error);if(note.template.fields.some(field=>field.required&&!note.values?.[field.name]?.trim()))throw new Error('Thẻ thiếu trường bắt buộc.')}
  const generated=generateCards(note as Note)
  if(!generated.length || generated.some(card=>!card.front.trim()||!card.back.trim()))throw new Error('Thẻ thiếu nội dung hoặc cú pháp cloze không hợp lệ.')
  cards.set(note.id,new Set(generated.map(card=>card.id)))
 }
 for(const row of data.reviews)if(!cards.get(row.noteId)?.has(row.id))throw new Error('Lịch ôn tham chiếu thẻ không tồn tại.')
 for(const row of data.reviewLogs)if(!cards.get(row.noteId)?.has(row.cardId))throw new Error('Lịch sử tham chiếu thẻ không tồn tại.')
 return data
}
export function backupCounts(data: VocabularyBackup){
 const kinds={basic:0,reverse:0,cloze:0,custom:0,ai:0}
 for(const note of data.notes)kinds[note.kind]++
 return {kinds,notes:data.notes.length,cards:data.notes.reduce((sum,note)=>sum+generateCards(note as Note).length,0),folders:data.folders.length,templates:data.templates.length,reviews:data.reviews.length,logs:data.reviewLogs.length}
}
