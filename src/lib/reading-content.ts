import DOMPurify from 'dompurify'
import { noteWord } from './related-words'
import type { Note } from './cards'
import type { ReadingMatch } from './reading-types'
export function cleanReadingHtml(html:string){
 return DOMPurify.sanitize(html,{ALLOWED_TAGS:['p','div','span','br','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','ul','ol','li','blockquote','a','table','thead','tbody','tr','td','th','hr','pre','code','sup','sub'],ALLOWED_ATTR:['href','title','colspan','rowspan'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false})
}
function readingDocument(html:string){
 const root=document.createElement('div');root.innerHTML=cleanReadingHtml(html)
 const spans:{node:Text;start:number;end:number}[]=[];let text=''
 const blocks=new Set(['P','DIV','BR','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','TR','HR'])
 function visit(node:Node){
  if(node.nodeType===3){const value=node.textContent??'';spans.push({node:node as Text,start:text.length,end:text.length+value.length});text+=value;return}
  if(!(node instanceof Element))return
  if(['A','CODE','PRE'].includes(node.tagName)){text+='\n';return}
  if(blocks.has(node.tagName))text+='\n'
  for(const child of [...node.childNodes])visit(child)
  if(blocks.has(node.tagName))text+='\n'
 }
 for(const child of [...root.childNodes])visit(child)
 return {root,text,spans}
}
const wordChar=(value:string)=>/[\p{L}\p{N}\p{M}_]/u.test(value)
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
export async function detectReadingVocab(html:string,notes:Note[],signal?:AbortSignal){
 const clean=cleanReadingHtml(html),{text}=readingDocument(clean)
 const groups=new Map<string,{word:string;noteId:string;pattern:RegExp}[]>(),seen=new Set<string>()
 for(const note of [...notes].sort((a,b)=>a.id.localeCompare(b.id))){
  const word=noteWord(note).trim().replace(/\s+/gu,' '),key=word.toLowerCase()
  if(!word||word.length>200||!/[\p{L}]/u.test(word)||/[<>\r\n]/u.test(word)||seen.has(key))continue
  seen.add(key);const first=key[0];const rows=groups.get(first)??[]
  rows.push({word,noteId:note.id,pattern:new RegExp(escape(word).replace(/ /g,'[^\\S\\r\\n]+'),'iyu')});groups.set(first,rows)
 }
 for(const rows of groups.values())rows.sort((a,b)=>b.word.length-a.word.length)
 const matches:ReadingMatch[]=[]
 for(let start=0;start<text.length;start++){
  if(start%1000===0){await new Promise(resolve=>setTimeout(resolve,0));if(signal?.aborted)throw new Error('Đã dừng dò từ vựng.')}
  if(start&&wordChar(text[start-1]))continue
  for(const entry of groups.get(text[start].toLowerCase())??[]){
   entry.pattern.lastIndex=start;const match=entry.pattern.exec(text)
   if(!match)continue
   const end=start+match[0].length
   if(end<text.length&&wordChar(text[end]))continue
   matches.push({start,end,noteId:entry.noteId,word:entry.word,context:text.slice(Math.max(0,start-100),Math.min(text.length,end+140)).replace(/\s+/gu,' ').trim()});if(matches.length>20000)throw new Error('Bài đọc có quá nhiều vị trí từ vựng (tối đa 20.000). Hãy chia bài đọc thành các phần nhỏ hơn.');start=end-1;break
  }
 }
 return {html:clean,matches,createdAt:new Date().toISOString()}
}
export function renderReadingHtml(html:string,detection:{html:string;matches:ReadingMatch[]}|undefined,validNoteIds:Set<string>){
 const {root,spans}=readingDocument(html)
 if(!detection||detection.html!==cleanReadingHtml(html))return root.innerHTML
 const matches=detection.matches.filter(match=>Number.isInteger(match.start)&&Number.isInteger(match.end)&&match.start>=0&&match.end>match.start&&validNoteIds.has(match.noteId)).sort((a,b)=>a.start-b.start)
 let matchIndex=0
 for(const span of spans){
  while(matchIndex<matches.length&&matches[matchIndex].end<=span.start)matchIndex++
  let cursor=0;const fragment=document.createDocumentFragment(),value=span.node.data
  for(let index=matchIndex;index<matches.length&&matches[index].start<span.end;index++){
   const match=matches[index]
   const start=Math.max(span.start,match.start)-span.start,end=Math.min(span.end,match.end)-span.start
   if(end<=start||start<cursor)continue
   fragment.append(document.createTextNode(value.slice(cursor,start)))
   const link=document.createElement('a');link.href='?note='+encodeURIComponent(match.noteId);link.dataset.readingNote=match.noteId;link.textContent=value.slice(start,end);link.title='Mở thẻ: '+match.word;link.className='reading-vocab-link';fragment.append(link);cursor=end
  }
  if(cursor){fragment.append(document.createTextNode(value.slice(cursor)));span.node.replaceWith(fragment)}
 }
 return root.innerHTML
}
