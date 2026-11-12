import { grammarImportPrompt } from './grammar-import-prompt'
import { parseGrammarImport } from './grammar-json'
import { prepareGrammarHtml, grammarHtmlText } from './grammar-html'

export async function requestGrammarGeneration(title:string,signal:AbortSignal,send:typeof fetch=fetch){
 const clean=title.trim()
 if(!clean||clean.length>160)throw new Error('Nhập tên ngữ pháp từ 1 đến 160 ký tự trước khi tạo AI.')
 const response=await send('/api/ai/generate-grammar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:clean,prompt:grammarImportPrompt(clean)}),signal})
 const payload=await response.json().catch(()=>null)
 if(!response.ok)throw new Error(typeof payload?.error==='string'?payload.error:'Không kết nối được dịch vụ tạo ngữ pháp. Kiểm tra backend rồi thử lại.')
 let parsed
 try{parsed=parseGrammarImport(JSON.stringify(payload))}catch{throw new Error('AI trả về nội dung không hợp lệ. Hãy thử lại.')}
 if(!('contentHtml' in parsed))throw new Error('AI trả về nội dung không đúng định dạng.')
 const contentHtml=prepareGrammarHtml(parsed.contentHtml)
 if(!grammarHtmlText(contentHtml))throw new Error('AI trả về nội dung trống. Hãy thử lại.')
 return {name:parsed.name,contentHtml}
}
