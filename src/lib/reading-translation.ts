import { cleanReadingHtml } from './reading-content'

export function translationChunks(html:string){
 const root=document.createElement('div');root.innerHTML=cleanReadingHtml(html)
 root.querySelectorAll('br').forEach(node=>node.replaceWith('\n'))
 root.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,li,blockquote,tr,pre').forEach(node=>node.append('\n\n'))
 root.querySelectorAll('td,th').forEach(node=>node.append('\t'))
 let text=(root.textContent??'').replace(/\n{3,}/g,'\n\n').trim()
 const chunks:string[]=[]
 while(text.length){
  let end=Math.min(6000,text.length)
  if(end<text.length){
   const paragraph=text.lastIndexOf('\n',end),space=text.lastIndexOf(' ',end)
   end=paragraph>3000?paragraph:space>3000?space:end
   if(end===6000&&/[\uD800-\uDBFF]/.test(text[end-1]))end--
  }
  chunks.push(text.slice(0,end));text=text.slice(end).trim()
 }
 return chunks
}
