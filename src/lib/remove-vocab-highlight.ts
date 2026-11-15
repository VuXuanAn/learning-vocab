import { db, type VocabDatabase } from './db'
import { saveReadingArticle } from './reading-storage'
import { saveShadowingLesson } from './shadowing-storage'
import type { ReadingArticle } from './reading-types'

export interface VocabHighlight { kind:'reading'|'shadowing';sourceId:string;noteId:string;start:number;end:number }
export async function removeVocabHighlight(target:VocabHighlight,ownerId:string,account:VocabDatabase=db){
 return account.transaction('rw',[account.readingFolders,account.readingArticles,account.readingStudyNotes,account.notes,account.folders,account.shadowingFolders,account.shadowingLessons,account.speakingRecordings],async()=>{
  const trim=(detection:ReadingArticle['detection'])=>{
   if(!detection)return undefined
   const matches=detection.matches.filter(match=>match.start!==target.start||match.end!==target.end||match.noteId!==target.noteId)
   return matches.length===detection.matches.length?undefined:{...detection,matches,createdAt:new Date().toISOString()}
  }
  if(target.kind==='reading'){
   const article=await account.readingArticles.get(target.sourceId)
   if(!article||article.ownerId!==ownerId||article.deletedAt)throw new Error('Không có quyền bỏ highlight trong bài đọc này.')
   const detection=trim(article.detection)
   if(!detection)return false
   await saveReadingArticle({...article,detection},account)
  }else{
   const lesson=await account.shadowingLessons.get(target.sourceId)
   if(!lesson||lesson.ownerId!==ownerId)throw new Error('Không có quyền bỏ highlight trong bài shadowing này.')
   const detection=trim(lesson.detection)
   if(!detection)return false
   await saveShadowingLesson({...lesson,detection},account)
  }
  return true
 })
}
