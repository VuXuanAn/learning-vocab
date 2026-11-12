import { grammarHighlightRanges } from './reading-grammar'
import { irregularVerbs, irregularVerbForms, irregularVerbId, findIrregularVerb, isIrregularVerbForm } from './irregular-verbs'
import type { GrammarEntry } from './grammar-types'
import { createReadingSimilarity, readingSearchWords, type ReadingSuggestion } from './reading-similarity'
﻿import DOMPurify from 'dompurify'
import { noteWord } from './related-words'
import type { Note } from './cards'
import type { ReadingMatch } from './reading-types'
export function cleanReadingHtml(html:string){
 return DOMPurify.sanitize(html,{ALLOWED_TAGS:['p','div','span','br','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','ul','ol','li','blockquote','a','table','thead','tbody','tr','td','th','hr','pre','code','sup','sub'],ALLOWED_ATTR:['href','title','colspan','rowspan'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false})
}
function readingDocument(html:string){
 const root=document.createElement('div');root.innerHTML=cleanReadingHtml(html)
 return indexReadingRoot(root)
}
function indexReadingRoot(root:HTMLElement,rendered=false){
 const spans:{node:Text;start:number;end:number}[]=[];let text=''
 const blocks=new Set(['P','DIV','BR','H1','H2','H3','H4','H5','H6','LI','BLOCKQUOTE','TR','HR'])
 function visit(node:Node){
  if(node.nodeType===3){const value=node.textContent??'';spans.push({node:node as Text,start:text.length,end:text.length+value.length});text+=value;return}
  if(!(node instanceof Element))return
  if(['A','CODE','PRE'].includes(node.tagName)&&!(rendered&&node.tagName==='A'&&(node.hasAttribute('data-reading-note')||node.hasAttribute('data-reading-grammar')))){text+='\n';return}
  if(blocks.has(node.tagName))text+='\n'
  for(const child of [...node.childNodes])visit(child)
  if(blocks.has(node.tagName))text+='\n'
 }
 for(const child of [...root.childNodes])visit(child)
 return {root,text,spans}
}
const wordChar=(value:string)=>/[\p{L}\p{N}\p{M}_]/u.test(value)
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
export async function detectReadingVocab(html:string,notes:Note[],signal?:AbortSignal,previous?:{html:string;matches:ReadingMatch[]}){
 const clean=cleanReadingHtml(html),{text}=readingDocument(clean)
 const groups=new Map<string,{word:string;noteId:string;pattern:RegExp}[]>(),seen=new Set<string>()
 for(const note of [...notes].sort((a,b)=>a.id.localeCompare(b.id)))for(const word of readingSearchWords(noteWord(note))){
  const key=word.toLowerCase()
  if(!word||word.length>200||!/[\p{L}]/u.test(word)||/[<>\r\n]/u.test(word)||seen.has(key))continue
  seen.add(key);const first=key[0];const rows=groups.get(first)??[]
  rows.push({word,noteId:note.id,pattern:new RegExp(escape(word).replace(/ /g,'[^\\S\\r\\n]+'),'iyu')});groups.set(first,rows)
 }
 // Saved vocabulary wins when the same spelling exists in both sources.
 for(const verb of irregularVerbs)for(const word of irregularVerbForms(verb)){
  if(seen.has(word))continue
  seen.add(word)
  const rows=groups.get(word[0])??[]
  rows.push({word,noteId:irregularVerbId(verb),pattern:new RegExp(escape(word),'iyu')});groups.set(word[0],rows)
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
 // Keep prior user confirmations while the source and linked cards still exist.
 const validIds=new Set(notes.map(note=>note.id))
 if(previous?.html===clean)for(const match of previous.matches){
  if(match.confirmed&&validIds.has(match.noteId)&&!matches.some(exact=>match.start<exact.end&&match.end>exact.start))matches.push(match)
 }
 matches.sort((a,b)=>a.start-b.start)
 const similar=createReadingSimilarity(notes.flatMap(note=>readingSearchWords(noteWord(note)).filter(word=>seen.has(word.toLowerCase())).map(word=>({noteId:note.id,word,meaning:(note.values?.['Nghĩa tiếng Việt']||note.back||'').slice(0,400)}))))
 const suggestions=new Map<string,ReadingSuggestion>(),cache=new Map<string,ReturnType<typeof similar>>()
 let cursor=0,index=0
 for(const token of text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)){
  if(index++%50===0){await new Promise(resolve=>setTimeout(resolve,0));if(signal?.aborted)throw new Error('Đã dừng dò từ vựng.')}
  const start=token.index,end=start+token[0].length
  while(cursor<matches.length&&matches[cursor].end<=start)cursor++
  if(cursor<matches.length&&matches[cursor].start<end)continue
  // Avoid fragments inside digits, identifiers or hyphenated words.
  if(start&&/[\p{L}\p{N}_’-]/u.test(text[start-1])||end<text.length&&/[\p{L}\p{N}_’-]/u.test(text[end]))continue
  const key=token[0].toLowerCase()
  let candidates=cache.get(key)
  if(!candidates){candidates=similar(key);cache.set(key,candidates)}
  if(!candidates.length)continue
  const row=suggestions.get(key)??{word:token[0],occurrences:[],candidates}
  row.occurrences.push({start,end,context:text.slice(Math.max(0,start-80),Math.min(text.length,end+100)).replace(/\s+/gu,' ').trim()});suggestions.set(key,row)
 }
 return {html:clean,matches,createdAt:new Date().toISOString(),suggestions:[...suggestions.values()]}
}
export function renderReadingHtml(html:string,detection:{html:string;matches:ReadingMatch[]}|undefined,validNoteIds:Set<string>){
 const {root,spans,text}=readingDocument(html)
 if(!detection||detection.html!==cleanReadingHtml(html))return root.innerHTML
 const matches=detection.matches.filter(match=>Number.isInteger(match.start)&&Number.isInteger(match.end)&&match.start>=0&&match.end>match.start&&(validNoteIds.has(match.noteId)||findIrregularVerb(match.noteId))).sort((a,b)=>a.start-b.start)
 let matchIndex=0
 for(const span of spans){
  while(matchIndex<matches.length&&matches[matchIndex].end<=span.start)matchIndex++
  let cursor=0;const fragment=document.createDocumentFragment(),value=span.node.data
  for(let index=matchIndex;index<matches.length&&matches[index].start<span.end;index++){
   const match=matches[index]
   const start=Math.max(span.start,match.start)-span.start,end=Math.min(span.end,match.end)-span.start
   if(end<=start||start<cursor)continue
   fragment.append(document.createTextNode(value.slice(cursor,start)))
   // Old/confirmed detections can store a card label rather than the surface form.
   const irregular=!!findIrregularVerb(match.noteId)||isIrregularVerbForm(text.slice(match.start,match.end))
   const link=document.createElement('a');link.href='?note='+encodeURIComponent(match.noteId);link.dataset.readingNote=match.noteId;link.textContent=value.slice(start,end);link.title=(irregular?'Động từ bất quy tắc: ':'Mở thẻ: ')+match.word;link.className='reading-vocab-link'+(irregular?' reading-irregular-link':'');fragment.append(link);cursor=end
  }
  if(cursor){fragment.append(document.createTextNode(value.slice(cursor)));span.node.replaceWith(fragment)}
 }
 return root.innerHTML
}

export function readingSelection(html:string,root:HTMLElement,range:Range){
 if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return null
 const index=indexReadingRoot(root,true),original=readingDocument(html)
 if(index.text!==original.text)return null
 let start:number|undefined,end:number|undefined
 for(const span of index.spans){
  if(!range.intersectsNode(span.node))continue
  const part=document.createRange();part.selectNodeContents(span.node)
  if(range.compareBoundaryPoints(0,part)>0)part.setStart(range.startContainer,range.startOffset)
  if(range.compareBoundaryPoints(2,part)<0)part.setEnd(range.endContainer,range.endOffset)
  if(part.collapsed)continue
  const from=span.start+(part.startContainer===span.node?part.startOffset:0)
  const to=span.start+(part.endContainer===span.node?part.endOffset:span.node.length)
  if(to>from){start??=from;end=to}
 }
 if(start===undefined||end===undefined)return null
 const raw=index.text.slice(start,end),left=raw.length-raw.trimStart().length,right=raw.length-raw.trimEnd().length
 start+=left;end-=right
 return start<end?{start,end,quote:index.text.slice(start,end)}:null
}
export function highlightReadingGrammar(renderedHtml:string,sourceHtml:string,entries:GrammarEntry[],articleId?:string){
 const root=document.createElement('div');root.innerHTML=renderedHtml
 const {text,spans}=indexReadingRoot(root,true)
 const valid=entries.flatMap(entry=>[...(entry.source?[entry.source]:[]),...(entry.sources??[])].map(source=>({...entry,source}))).filter(entry=>(!articleId||entry.source.articleId===articleId)&&entry.source?.contentHtml===sourceHtml&&text.slice(entry.source.start,entry.source.end)===entry.source.quote)
 const ranges=valid.flatMap(entry=>grammarHighlightRanges(entry.source!,entry.structure).map(range=>({...range,id:entry.id,title:entry.structure})))
 for(const span of spans){
  const relevant=ranges.filter(range=>range.start<span.end&&range.end>span.start)
  if(!relevant.length)continue
  const boundaries=[...new Set([0,span.node.length,...relevant.flatMap(range=>[Math.max(0,range.start-span.start),Math.min(span.node.length,range.end-span.start)])])].sort((a,b)=>a-b)
  const fragment=document.createDocumentFragment(),value=span.node.data
  for(let i=0;i<boundaries.length-1;i++){
   const from=boundaries[i],to=boundaries[i+1],range=relevant.find(range=>range.start<=span.start+from&&range.end>=span.start+to)
   const node=document.createTextNode(value.slice(from,to))
   if(range){const mark=document.createElement('mark');mark.dataset.readingGrammar=range.id;mark.title=range.title;mark.className='reading-grammar-highlight';mark.append(node);fragment.append(mark)}else fragment.append(node)
  }
  span.node.replaceWith(fragment)
 }
 // A grammar structure is one link, including the words between its highlighted keywords.
 const phrases=valid.map(entry=>{
  const highlights=grammarHighlightRanges(entry.source!,entry.structure)
  return {entry,start:Math.min(...highlights.map(range=>range.start)),end:Math.max(...highlights.map(range=>range.end))}
 }).filter(phrase=>Number.isFinite(phrase.start)&&phrase.end>phrase.start).sort((a,b)=>a.start-b.start||b.end-a.end)
 const links:typeof phrases=[]
 for(const phrase of phrases)if(!links.length||phrase.start>=links.at(-1)!.end)links.push(phrase)
 // Grammar links take priority over vocabulary links in the same phrase; avoid nested anchors.
 const indexed=indexReadingRoot(root,true)
 const vocabLinks=new Set<HTMLAnchorElement>()
 for(const span of indexed.spans)if(links.some(phrase=>phrase.start<span.end&&phrase.end>span.start)){
  const anchor=span.node.parentElement?.closest<HTMLAnchorElement>('a[data-reading-note]')
  if(anchor)vocabLinks.add(anchor)
 }
 for(const anchor of vocabLinks)anchor.replaceWith(...anchor.childNodes)
 for(const phrase of [...links].reverse()){
  const {spans:current}=indexReadingRoot(root,true)
  const first=current.find(span=>span.end>phrase.start&&span.start<phrase.end)
  const last=current.findLast(span=>span.start<phrase.end&&span.end>phrase.start)
  if(!first||!last)continue
  const range=document.createRange()
  range.setStart(first.node,Math.max(0,phrase.start-first.start))
  range.setEnd(last.node,Math.min(last.node.length,phrase.end-last.start))
  // Keep the link outside fully selected inline wrappers, especially yellow marks.
  const blocks=new Set(['P','DIV','LI','BLOCKQUOTE','TD','TH','H1','H2','H3','H4','H5','H6'])
  if(range.startOffset===0){
   let node:Node=first.node
   while(node.parentElement&&node.parentElement!==root&&!blocks.has(node.parentElement.tagName)&&!node.previousSibling)node=node.parentElement
   range.setStartBefore(node)
  }
  if(range.endOffset===last.node.length){
   let node:Node=last.node
   while(node.parentElement&&node.parentElement!==root&&!blocks.has(node.parentElement.tagName)&&!node.nextSibling)node=node.parentElement
   range.setEndAfter(node)
  }
  const contents=range.extractContents()
  for(const anchor of contents.querySelectorAll('a'))anchor.replaceWith(...anchor.childNodes)
  const link=document.createElement('a')
  link.href='/grammar?folder='+encodeURIComponent(phrase.entry.folderId)+'&grammar='+encodeURIComponent(phrase.entry.id)
  link.dataset.readingGrammar=phrase.entry.id;link.title=phrase.entry.structure;link.className='reading-grammar-link'
  link.append(contents);range.insertNode(link)
 }
 return root.innerHTML
}
