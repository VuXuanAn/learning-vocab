import { z } from 'zod'
import type { GrammarDocument } from './grammar-types'

const id=z.number().int().positive()
const schema=z.object({
 name:z.string().trim().min(1).max(160),
 level:z.enum(['','A1','A2','B1','B2','C1','C2']),
 structures:z.array(z.object({id,type:z.string().trim().max(100),formula:z.string().trim().min(1).max(5000)})).min(1).max(30),
 usages:z.array(z.object({id,content:z.string().trim().max(20000)})).max(50),
 examples:z.array(z.object({id,en:z.string().trim().max(10000),vi:z.string().trim().max(10000)})).max(50),
 notes:z.string().trim().max(20000),
})

export function parseGrammarJson(text:string):GrammarDocument {
 if(text.length>1500000)throw new Error('JSON quá lớn (tối đa 1,5 MB ký tự).')
 let value:unknown
 try{value=JSON.parse(text.replace(/^\uFEFF/,''))}catch{throw new Error('JSON không hợp lệ. Kiểm tra dấu ngoặc, dấu phẩy và dấu nháy kép.')}
 const parsed=schema.safeParse(value)
 if(!parsed.success)throw new Error('Kiểm tra trường '+parsed.error.issues.map(issue=>issue.path.join('.')).join(', ')+'. Dùng mẫu JSON để xem định dạng và giới hạn các trường.')
 for(const key of ['structures','usages','examples'] as const){
  const rows=parsed.data[key]
  if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('Các id trong '+key+' phải khác nhau và là số nguyên dương.')
 }
 if(parsed.data.examples.some(row=>row.vi&&!row.en))throw new Error('Mỗi ví dụ có bản dịch cần kèm câu tiếng Anh (en).')
 return parsed.data
}

export const grammarJsonTemplate:GrammarDocument={
 name:'Hiện tại đơn - Present Simple',level:'A1',
 structures:[{id:1,type:'Khẳng định',formula:'S + V(s/es) + O'},{id:2,type:'Phủ định',formula:'S + do/does + not + V + O'},{id:3,type:'Nghi vấn',formula:'Do/Does + S + V + O?'}],
 usages:[{id:1,content:'Diễn tả thói quen, hành động lặp lại.'},{id:2,content:'Diễn tả sự thật hiển nhiên.'}],
 examples:[{id:1,en:'I study English every day.',vi:'Tôi học tiếng Anh mỗi ngày.'},{id:2,en:"She doesn't drink coffee.",vi:'Cô ấy không uống cà phê.'}],
 notes:'He/She/It + V(s/es). Sau do/does, dùng động từ nguyên mẫu.',
}
