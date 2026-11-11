import { z } from 'zod'
import type { Note } from './cards'
import type { ReadingArticle } from './reading-types'
export const readingSourceKey=(articleId:string)=>'__readingSource:'+articleId
const schema=z.object({articleId:z.string().uuid(),ownerId:z.string().min(1),title:z.string().max(160),quote:z.string().max(1000),occurrences:z.number().int().positive(),detectedAt:z.string()})
export type ReadingSource=z.infer<typeof schema>
export function readingSources(note:Note){
 const sources:ReadingSource[]=[]
 for(const [key,value] of Object.entries(note.values??{})){
  if(!key.startsWith('__readingSource:'))continue
  try{const result=schema.safeParse(JSON.parse(value));if(result.success&&key===readingSourceKey(result.data.articleId))sources.push(result.data)}catch{/* Invalid imported metadata is ignored. */}
 }
 return sources.sort((a,b)=>b.detectedAt.localeCompare(a.detectedAt))
}
export function sourcesForArticle(article:ReadingArticle){
 const sources=new Map<string,ReadingSource>()
 if(article.deletedAt||!article.detection)return sources
 for(const match of article.detection.matches){
  const previous=sources.get(match.noteId)
  sources.set(match.noteId,{articleId:article.id,ownerId:article.ownerId,title:article.title,quote:previous?.quote||match.context||match.word,occurrences:(previous?.occurrences??0)+1,detectedAt:article.detection.createdAt})
 }
 return sources
}
