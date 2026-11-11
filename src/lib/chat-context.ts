export interface ChatMessage {id:string;role:'user'|'assistant';content:string}
// Send recent turns only. The browser remains the sole owner of chat history.
export function chatContext(messages:ChatMessage[]){
 let recent=messages.map(({role,content})=>({role,content:content.slice(0,3000)}))
 while(recent.length>19||recent.reduce((sum,message)=>sum+message.content.length,0)>10000)recent=recent.slice(2)
 if(recent[0]?.role==='assistant')recent=recent.slice(1)
 return recent
}
