import { cleanReadingHtml, readingSelection } from './reading-content'
import type { GrammarSource } from './reading-grammar'

export const grammarSelectionBlocks='p,h1,h2,h3,h4,h5,h6,li,td,th,blockquote,article,.grammar-rich-content,.reading-content,main,[role="dialog"]'
export function grammarSelectionRoot(range:Range){
 const element=range.startContainer instanceof Element?range.startContainer:range.startContainer.parentElement
 const end=range.endContainer instanceof Element?range.endContainer:range.endContainer.parentElement
 const candidates=element?.closest('[data-reading-article],[data-shadowing-lesson]')
 if(candidates instanceof HTMLElement&&candidates.contains(end))return candidates
 let root=element?.closest(grammarSelectionBlocks)
 while(root&&!root.contains(end))root=root.parentElement?.closest(grammarSelectionBlocks)??null
 return root instanceof HTMLElement?root:null
}
function snapshotId(value:string){
 const chunks=[1,2,3,4].map(seed=>{
  let hash=2166136261^seed
  for(let index=0;index<value.length;index++)hash=Math.imul(hash^value.charCodeAt(index),16777619)
  return (hash>>>0).toString(16).padStart(8,'0')
 }).join('')
 return `${chunks.slice(0,8)}-${chunks.slice(8,12)}-4${chunks.slice(13,16)}-8${chunks.slice(17,20)}-${chunks.slice(20)}`
}
export function grammarSelectionSource(root:HTMLElement,range:Range,options:{kind:'reading'|'shadowing'|'page';path:string;id?:string;title:string;html?:string}):GrammarSource|null{
 const html=options.html??cleanReadingHtml(root.innerHTML)
 if(html.length>200000)return null
 const selected=readingSelection(html,root,range)
 if(!selected||selected.quote.length>10000)return null
 return {...selected,sourceKind:options.kind,sourcePath:options.path,articleId:options.id??snapshotId(options.path+'\n'+html),articleTitle:options.title.slice(0,160),contentHtml:html,highlights:[]}
}
