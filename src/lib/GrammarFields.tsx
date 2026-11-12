import { useState } from 'react'
import { Plus, Trash2, Lightbulb, Braces, MessageSquare, Copy, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { grammarJsonTemplate, parseGrammarJson } from './grammar-json'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import StyledSelect from '@/components/ui/styled-select'
import { grammarDocument, withGrammarDocument } from './grammar-document'
import type { GrammarDocument, GrammarEntry } from './grammar-types'

export default function GrammarFields({value,onChange}:{value:GrammarEntry;onChange:(value:GrammarEntry)=>void}) {
 const [importOpen,setImportOpen]=useState(false)
 const [json,setJson]=useState('')
 const [importError,setImportError]=useState('')
 const document=grammarDocument(value)
 async function copyTemplate(){
  try{
   await navigator.clipboard.writeText(JSON.stringify(grammarJsonTemplate,null,2))
   toast.success('Đã sao chép mẫu JSON.')
  }catch{
   setJson(JSON.stringify(grammarJsonTemplate,null,2));setImportOpen(true);setImportError('')
   toast.info('Không truy cập được clipboard. Bạn có thể chọn và sao chép mẫu trong ô JSON.')
  }
 }
 function importJson(){
  try{const imported=parseGrammarJson(json);onChange(withGrammarDocument(value,imported));setImportError('');setImportOpen(false);setJson('');toast.success('Đã điền JSON vào form. Kiểm tra rồi bấm Lưu ngữ pháp.')}
  catch(error){setImportError(error instanceof Error?error.message:'Không đọc được JSON.')}
 }
 function change(patch:Partial<GrammarDocument>){onChange(withGrammarDocument(value,{...document,...patch}))}
 const nextId=(rows:{id:number}[])=>Math.max(0,...rows.map(row=>row.id))+1
 return <div className="space-y-6">
  <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={()=>void copyTemplate()}><Copy size={16}/>Copy JSON format</Button><Button type="button" variant="outline" aria-expanded={importOpen} aria-controls="grammar-json-import" onClick={()=>setImportOpen(open=>!open)}><Upload size={16}/>Import JSON</Button></div>
  {importOpen&&<section id="grammar-json-import" className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"><Label htmlFor="grammar-json-input">Dán JSON ngữ pháp</Label><p className="text-xs leading-5 text-slate-500">Điền dữ liệu JSON vào các trường bên dưới, thay thế nội dung đang nhập. Thư mục và liên kết bài đọc được giữ nguyên.</p><textarea id="grammar-json-input" rows={10} maxLength={1500000} autoFocus spellCheck={false} className="font-mono text-xs" placeholder={'{\n  "name": "Hiện tại đơn - Present Simple",\n  ...\n}'} value={json} onChange={event=>{setJson(event.target.value);setImportError('')}}/>{importError&&<p role="alert" className="text-sm text-red-600">{importError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={()=>{setImportOpen(false);setImportError('')}}>Hủy import</Button><Button type="button" disabled={!json.trim()} onClick={importJson}>Điền vào form</Button></div></section>}
  <div className="space-y-2"><Label htmlFor="grammar-name">Tên ngữ pháp *</Label><Input id="grammar-name" required maxLength={160} value={document.name} placeholder="Hiện tại đơn - Present Simple" onChange={event=>change({name:event.target.value})}/></div>
  <div className="space-y-2"><Label htmlFor="grammar-level">Cấp độ</Label><StyledSelect id="grammar-level" value={document.level} onChange={event=>change({level:event.target.value})}><option value="">Chưa chọn</option>{['A1','A2','B1','B2','C1','C2'].map(level=><option key={level} value={level}>{level}</option>)}</StyledSelect></div>
  <section className="space-y-4 border-t pt-5"><h3 className="flex items-center gap-2 font-semibold"><Braces size={17}/>Cấu trúc <span className="text-red-500">*</span></h3>{document.structures.map((row,index)=><div key={row.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-3"><div className="flex items-center justify-between"><Label htmlFor={'grammar-formula-'+row.id}>Công thức {index+1}</Label><Button type="button" variant="ghost" size="icon" aria-label={'Xóa công thức '+(index+1)} onClick={()=>change({structures:document.structures.filter(item=>item.id!==row.id)})}><Trash2 size={15}/></Button></div><Input aria-label={'Loại công thức '+(index+1)} maxLength={100} placeholder="Khẳng định / Phủ định / Nghi vấn" value={row.type} onChange={event=>change({structures:document.structures.map(item=>item.id===row.id?{...item,type:event.target.value}:item)})}/><textarea id={'grammar-formula-'+row.id} required maxLength={5000} rows={2} placeholder="S + V(s/es) + O" value={row.formula} onChange={event=>change({structures:document.structures.map(item=>item.id===row.id?{...item,formula:event.target.value}:item)})}/></div>)}<Button type="button" variant="outline" className="w-full" disabled={document.structures.length>=30} onClick={()=>change({structures:[...document.structures,{id:nextId(document.structures),type:'',formula:''}]})}><Plus size={15}/>Thêm cấu trúc</Button></section>
  <section className="space-y-3 border-t pt-5"><h3 className="flex items-center gap-2 font-semibold"><Lightbulb size={17}/>Cách dùng</h3>{document.usages.map((row,index)=><div key={row.id} className="flex items-start gap-2"><textarea aria-label={'Cách dùng '+(index+1)} rows={2} maxLength={20000} placeholder={'Cách dùng '+(index+1)} value={row.content} onChange={event=>change({usages:document.usages.map(item=>item.id===row.id?{...item,content:event.target.value}:item)})}/><Button type="button" variant="ghost" size="icon" aria-label={'Xóa cách dùng '+(index+1)} onClick={()=>change({usages:document.usages.filter(item=>item.id!==row.id)})}><Trash2 size={15}/></Button></div>)}<Button type="button" variant="outline" className="w-full" disabled={document.usages.length>=50} onClick={()=>change({usages:[...document.usages,{id:nextId(document.usages),content:''}]})}><Plus size={15}/>Thêm cách dùng</Button></section>
  <section className="space-y-4 border-t pt-5"><h3 className="flex items-center gap-2 font-semibold"><MessageSquare size={17}/>Ví dụ</h3>{document.examples.map((row,index)=><div key={row.id} className="space-y-2 rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between"><span className="text-sm font-medium">Ví dụ {index+1}</span><Button type="button" variant="ghost" size="icon" aria-label={'Xóa ví dụ '+(index+1)} onClick={()=>change({examples:document.examples.filter(item=>item.id!==row.id)})}><Trash2 size={15}/></Button></div><Label htmlFor={'grammar-en-'+row.id}>Tiếng Anh</Label><textarea id={'grammar-en-'+row.id} rows={2} maxLength={10000} placeholder="I study English every day." value={row.en} onChange={event=>change({examples:document.examples.map(item=>item.id===row.id?{...item,en:event.target.value}:item)})}/><Label htmlFor={'grammar-vi-'+row.id}>Tiếng Việt</Label><textarea id={'grammar-vi-'+row.id} rows={2} maxLength={10000} placeholder="Tôi học tiếng Anh mỗi ngày." value={row.vi} onChange={event=>change({examples:document.examples.map(item=>item.id===row.id?{...item,vi:event.target.value}:item)})}/></div>)}<Button type="button" variant="outline" className="w-full" disabled={document.examples.length>=50} onClick={()=>change({examples:[...document.examples,{id:nextId(document.examples),en:'',vi:''}]})}><Plus size={15}/>Thêm ví dụ</Button></section>
  <div className="space-y-2 border-t pt-5"><Label htmlFor="grammar-notes">Ghi chú</Label><textarea id="grammar-notes" rows={3} maxLength={20000} value={document.notes} placeholder="Lưu ý hoặc lỗi dễ nhầm…" onChange={event=>change({notes:event.target.value})}/></div>
 </div>
}
