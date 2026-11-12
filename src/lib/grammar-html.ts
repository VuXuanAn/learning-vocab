import DOMPurify from 'dompurify'
import { grammarDocument } from './grammar-document'
import type { GrammarEntry } from './grammar-types'

export const grammarHtmlLimit=1500000
const styleRules:Record<string,RegExp>={
 'color':/^(?:#[a-f\d]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d.,%\s/+-]+\))$/i,
 'background-color':/^(?:#[a-f\d]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d.,%\s/+-]+\))$/i,
 'font-family':/^[a-z\d\s,'"-]{1,200}$/i,
 'font-size':/^(?:[1-9]\d{0,2}(?:\.\d+)?(?:px|pt)|[0-9](?:\.\d+)?(?:em|rem)|(?:xx?-small|small|medium|large|x-large|xx-large))$/i,
 'font-weight':/^(?:normal|bold|[1-9]00)$/,
 'font-style':/^(?:normal|italic|oblique)$/,
 'text-decoration':/^(?:(?:none|underline|line-through|overline)(?:\s+|$))+$/,
 'text-align':/^(?:left|center|right|justify|start|end)$/,
 'line-height':/^(?:normal|[0-9](?:\.\d+)?|[1-9]\d{0,2}(?:px|%))$/,
 'margin-left':/^(?:0|[0-9]{1,2}(?:\.\d+)?(?:em|px))$/,
 'width':/^(?:auto|[1-9]\d{0,3}(?:px|%))$/,
 'height':/^(?:auto|[1-9]\d{0,3}px)$/,
}
export function cleanGrammarHtml(html:string){
 const safe=DOMPurify.sanitize(html,{ALLOWED_TAGS:['p','div','span','br','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','ul','ol','li','blockquote','a','table','colgroup','col','thead','tbody','tr','td','th','hr','pre','code','sup','sub','mark','img','label','input'],ALLOWED_ATTR:['href','title','colspan','rowspan','colwidth','style','src','alt','width','height','start','type','checked','disabled','data-type','data-checked','data-color'],ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false})
 const root=document.createElement('div');root.innerHTML=safe
 for(const element of root.querySelectorAll<HTMLElement>('*')){
  const style=element.style
  const declarations=Object.keys(styleRules).map(property=>[property,style.getPropertyValue(property).trim()])
  element.removeAttribute('style')
  for(const [property,value] of declarations)if(styleRules[property]?.test(value))element.style.setProperty(property,value)
  if(!element.getAttribute('style'))element.removeAttribute('style')
  const type=element.getAttribute('data-type')
  if(!((element.tagName==='UL'&&type==='taskList')||(element.tagName==='LI'&&type==='taskItem')))element.removeAttribute('data-type')
  if(element.tagName==='LI'&&type==='taskItem')element.setAttribute('data-checked',element.getAttribute('data-checked')==='true'?'true':'false')
  else element.removeAttribute('data-checked')
  if(element.tagName!=='MARK'||!styleRules['color'].test(element.getAttribute('data-color')??''))element.removeAttribute('data-color')
  if(element.tagName==='INPUT'){
   if(element.getAttribute('type')!=='checkbox'||!element.closest('li[data-type="taskItem"]')){element.remove();continue}
   element.setAttribute('disabled','')
  }
  if(element.tagName==='IMG'){
   const src=element.getAttribute('src')??''
   if(!/^(?:https?:\/\/|data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z\d+/]+=*$)/i.test(src)){element.remove();continue}
   element.setAttribute('loading','lazy');element.setAttribute('referrerpolicy','no-referrer')
  }
 }
 return root.innerHTML
}
const escape=(text:string)=>text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const paragraph=(text:string)=>'<p>'+escape(text).replace(/\r?\n/g,'<br>')+'</p>'
export function grammarEntryHtml(entry:GrammarEntry){
 if(entry.contentHtml!==undefined)return entry.contentHtml
 const value=grammarDocument(entry),parts:string[]=[]
 if(value.level)parts.push(paragraph(value.level))
 const structures=value.structures.filter(row=>row.formula.trim()||row.type.trim())
 if(structures.length)parts.push('<h2>Cấu trúc</h2>'+structures.map(row=>(row.type?'<h3>'+escape(row.type)+'</h3>':'')+paragraph(row.formula)).join(''))
 const usages=value.usages.filter(row=>row.content.trim())
 if(usages.length)parts.push('<h2>Cách dùng</h2><ul>'+usages.map(row=>'<li>'+escape(row.content).replace(/\r?\n/g,'<br>')+'</li>').join('')+'</ul>')
 const examples=value.examples.filter(row=>row.en.trim()||row.vi.trim())
 if(examples.length)parts.push('<h2>Ví dụ</h2>'+examples.map(row=>paragraph(row.en)+(row.vi?paragraph(row.vi):'')).join(''))
 if(value.notes.trim())parts.push('<h2>Ghi chú</h2>'+paragraph(value.notes))
 return parts.join('\n')
}
export function grammarHtmlText(html:string){
 const root=document.createElement('div');root.innerHTML=cleanGrammarHtml(html)
 for(const element of root.querySelectorAll('br,p,div,h1,h2,h3,h4,h5,h6,li,tr,blockquote,pre,hr'))element.append(document.createTextNode('\n'))
 return (root.textContent??'').trim()
}
// Plain pasted notes remain readable, including line breaks and literal < or >.
export function prepareGrammarHtml(value:string){
 return cleanGrammarHtml(/<\/?[a-z][\s\S]*?>/i.test(value)?value:paragraph(value))
}
