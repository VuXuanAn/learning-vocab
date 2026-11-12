import { useEffect, useId, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Bold, Italic, Underline, Strikethrough, List, ListOrdered, ListChecks, Quote, Link2, Unlink, Table2, Undo2, Redo2, RemoveFormatting, Code, CodeXml, Superscript, Subscript, AlignLeft, AlignCenter, AlignRight, AlignJustify, IndentIncrease, IndentDecrease, Minus, ImagePlus, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import StyledSelect from '@/components/ui/styled-select'
import { cleanGrammarHtml, prepareGrammarHtml, grammarHtmlLimit } from './grammar-html'
import { grammarEditorExtensions } from './grammar-editor-extensions'

const fonts=[['','Font mặc định'],['Arial','Arial'],['Times New Roman','Times New Roman'],['Georgia','Georgia'],['Verdana','Verdana'],['Tahoma','Tahoma'],['Courier New','Courier New']]
const colorHex=(value:string|undefined,fallback:string)=>{if(/^#[a-f\d]{6}$/i.test(value??''))return value!;const rgb=value?.match(/^rgb\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)\s*\)$/i);return rgb?'#'+rgb.slice(1).map(channel=>Math.min(255,Number(channel)).toString(16).padStart(2,'0')).join(''):fallback}
const sizes=['12','14','16','18','20','24','28','32','36','48','64']
export default function GrammarTextEditor({value,onChange,disabled=false}:{value:string;onChange:(html:string)=>void;disabled?:boolean}) {
 const toolsId=useId()
 const lastValue=useRef(value),imageInput=useRef<HTMLInputElement>(null)
 const [expanded,setExpanded]=useState(false),[toolsOpen,setToolsOpen]=useState(false)
 const [panel,setPanel]=useState<'link'|'image'|null>(null)
 const [link,setLink]=useState(''),[linkError,setLinkError]=useState('')
 const [imageUrl,setImageUrl]=useState(''),[imageAlt,setImageAlt]=useState(''),[imageError,setImageError]=useState('')
 const [tableRows,setTableRows]=useState(3),[tableCols,setTableCols]=useState(3)
 const [imageLoading,setImageLoading]=useState(false)
 const editor=useEditor({
  extensions:grammarEditorExtensions(),content:prepareGrammarHtml(value),immediatelyRender:false,shouldRerenderOnTransaction:true,editable:!disabled,
  editorProps:{attributes:{id:'grammar-html',role:'textbox','aria-label':'Nội dung ngữ pháp','aria-multiline':'true',class:'grammar-text-editor grammar-rich-content reading-content min-h-80 break-words p-5 outline-none'},transformPastedHTML:cleanGrammarHtml},
  onUpdate:({editor})=>{const html=editor.isEmpty?'':editor.getHTML();lastValue.current=html;onChange(html)},
 })
 useEffect(()=>{if(!editor||value===lastValue.current)return;lastValue.current=value;editor.commands.setContent(prepareGrammarHtml(value),{emitUpdate:false})},[editor,value])
 useEffect(()=>{editor?.setEditable(!disabled,false)},[editor,disabled])
 if(!editor)return <p role="status" className="min-h-80 rounded-xl border p-5 text-sm text-slate-400">Đang mở trình soạn thảo…</p>
 const marks=[
  {label:'In đậm (Ctrl+B)',icon:Bold,name:'bold',run:()=>editor.chain().focus().toggleBold().run()},
  {label:'In nghiêng (Ctrl+I)',icon:Italic,name:'italic',run:()=>editor.chain().focus().toggleItalic().run()},
  {label:'Gạch chân (Ctrl+U)',icon:Underline,name:'underline',run:()=>editor.chain().focus().toggleUnderline().run()},
  {label:'Gạch ngang',icon:Strikethrough,name:'strike',run:()=>editor.chain().focus().toggleStrike().run()},
  {label:'Chỉ số trên',icon:Superscript,name:'superscript',run:()=>editor.chain().focus().toggleSuperscript().run()},
  {label:'Chỉ số dưới',icon:Subscript,name:'subscript',run:()=>editor.chain().focus().toggleSubscript().run()},
  {label:'Mã nội dòng',icon:Code,name:'code',run:()=>editor.chain().focus().toggleCode().run()},
 ]
 const blocks=[
  {label:'Danh sách dấu đầu dòng',icon:List,name:'bulletList',run:()=>editor.chain().focus().toggleBulletList().run()},
  {label:'Danh sách đánh số',icon:ListOrdered,name:'orderedList',run:()=>editor.chain().focus().toggleOrderedList().run()},
  {label:'Checklist',icon:ListChecks,name:'taskList',run:()=>editor.chain().focus().toggleTaskList().run()},
  {label:'Trích dẫn',icon:Quote,name:'blockquote',run:()=>editor.chain().focus().toggleBlockquote().run()},
  {label:'Khối mã',icon:CodeXml,name:'codeBlock',run:()=>editor.chain().focus().toggleCodeBlock().run()},
 ]
 const tableActions=[
  {label:'Hàng trên',run:()=>editor.chain().focus().addRowBefore().run()},
  {label:'Hàng dưới',run:()=>editor.chain().focus().addRowAfter().run()},
  {label:'Cột trái',run:()=>editor.chain().focus().addColumnBefore().run()},
  {label:'Cột phải',run:()=>editor.chain().focus().addColumnAfter().run()},
  {label:'Xóa hàng',run:()=>editor.chain().focus().deleteRow().run()},
  {label:'Xóa cột',run:()=>editor.chain().focus().deleteColumn().run()},
  {label:'Gộp ô',can:editor.can().mergeCells(),run:()=>editor.chain().focus().mergeCells().run()},
  {label:'Tách ô',can:editor.can().splitCell(),run:()=>editor.chain().focus().splitCell().run()},
  {label:'Hàng tiêu đề',run:()=>editor.chain().focus().toggleHeaderRow().run()},
  {label:'Cột tiêu đề',run:()=>editor.chain().focus().toggleHeaderColumn().run()},
  {label:'Xóa bảng',run:()=>editor.chain().focus().deleteTable().run()},
 ]
 const heading=[1,2,3,4,5,6].find(level=>editor.isActive('heading',{level}))
 const textStyle=editor.getAttributes('textStyle'),paragraphStyle=editor.getAttributes(heading?'heading':'paragraph')
 function indent(direction:number){
  if(editor!.isActive('taskItem')){editor!.chain().focus()[direction>0?'sinkListItem':'liftListItem']('taskItem').run();return}
  if(editor!.isActive('listItem')){editor!.chain().focus()[direction>0?'sinkListItem':'liftListItem']('listItem').run();return}
  const amount=Math.min(8,Math.max(0,Number(paragraphStyle.indent??0)+direction))
  editor!.chain().focus().updateAttributes('paragraph',{indent:amount}).updateAttributes('heading',{indent:amount}).run()
 }
 function applyLink(){
  let href=link.trim()
  if(href&&!/^(?:https?:\/\/|mailto:|\/[^/]|#)/i.test(href)){
   if(/^[\w-]+(?:\.[\w-]+)+(?:[/:?#]|$)/.test(href))href='https://'+href
   else{setLinkError('Nhập liên kết hợp lệ, ví dụ https://example.com.');return}
  }
  if(href)editor!.chain().focus().extendMarkRange('link').setLink({href}).run()
  else editor!.chain().focus().extendMarkRange('link').unsetLink().run()
  setPanel(null);setLinkError('')
 }
 function insertImage(src:string){
  if(src.length+editor!.getHTML().length>grammarHtmlLimit){setImageError('Ảnh quá lớn so với dung lượng nội dung. Hãy dùng ảnh nhỏ hơn hoặc URL ảnh.');return}
  editor!.chain().focus().setImage({src,alt:imageAlt.trim()}).run();setPanel(null);setImageError('');setImageUrl('');setImageAlt('')
 }
 async function uploadImage(file:File){
  if(!['image/png','image/jpeg','image/gif','image/webp','image/avif'].includes(file.type)){setImageError('Chọn ảnh PNG, JPG, GIF, WebP hoặc AVIF.');return}
  if(file.size>750000){setImageError('Chọn ảnh tối đa 750 KB, hoặc chèn bằng URL.');return}
  setImageLoading(true);setImageError('')
  try{const src=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Không đọc được ảnh.'));reader.readAsDataURL(file)});if(!editor!.isDestroyed&&editor!.isEditable)insertImage(src)}
  catch{setImageError('Không đọc được ảnh. Hãy thử lại.')}
  finally{setImageLoading(false)}
 }
 return <div className={'grammar-editor-shell relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-emerald-600 '+(expanded?'grammar-editor-expanded':'')}>
  <div role="toolbar" aria-label="Định dạng nội dung ngữ pháp" className="grammar-editor-toolbar relative shrink-0 border-b border-slate-200 bg-slate-50 p-2"><Button type="button" variant="outline" size="sm" className="grammar-toolbar-toggle" aria-expanded={toolsOpen} aria-controls={toolsId} onClick={()=>{setToolsOpen(open=>!open);setPanel(null)}}>{toolsOpen?'Ẩn công cụ':'Mở công cụ'}</Button><div id={toolsId} hidden={!toolsOpen} className={'grammar-format-options '+(toolsOpen?'grammar-format-options-open':'')}>
   <div className="flex flex-wrap items-center gap-1">
    <StyledSelect aria-label="Kiểu đoạn văn" className="w-32 text-sm" disabled={disabled} value={heading?'h'+heading:'p'} onChange={event=>{if(event.target.value==='p')editor.chain().focus().setParagraph().run();else editor.chain().focus().setHeading({level:Number(event.target.value.slice(1)) as 1|2|3|4|5|6}).run()}}><option value="p">Văn bản</option>{[1,2,3,4,5,6].map(level=><option key={level} value={'h'+level}>Tiêu đề {level}</option>)}</StyledSelect>
    <StyledSelect aria-label="Phông chữ" className="w-40 text-sm" disabled={disabled} value={textStyle.fontFamily??''} onChange={event=>event.target.value?editor.chain().focus().setFontFamily(event.target.value).run():editor.chain().focus().unsetFontFamily().run()}>{fonts.map(([value,label])=><option key={value} value={value}>{label}</option>)}</StyledSelect>
    <StyledSelect aria-label="Cỡ chữ" className="w-24 text-sm" disabled={disabled} value={textStyle.fontSize??''} onChange={event=>event.target.value?editor.chain().focus().setFontSize(event.target.value).run():editor.chain().focus().unsetFontSize().run()}><option value="">Cỡ chữ</option>{sizes.map(size=><option key={size} value={size+'px'}>{size}</option>)}</StyledSelect>
    <StyledSelect aria-label="Giãn dòng" className="w-28 text-sm" disabled={disabled} value={paragraphStyle.lineHeight??''} onChange={event=>editor.chain().focus().updateAttributes('paragraph',{lineHeight:event.target.value||null}).updateAttributes('heading',{lineHeight:event.target.value||null}).run()}><option value="">Giãn dòng</option>{['1','1.15','1.5','1.75','2','2.5','3'].map(size=><option key={size} value={size}>{size}</option>)}</StyledSelect>
    <Button type="button" variant="ghost" size="icon" aria-label={expanded?'Thu nhỏ trình soạn thảo':'Mở rộng trình soạn thảo'} title={expanded?'Thu nhỏ':'Mở rộng'} aria-pressed={expanded} onClick={()=>setExpanded(open=>!open)}>{expanded?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</Button>
   </div>
   <div className="flex flex-wrap items-center gap-1">
    {marks.map(tool=><Button key={tool.label} type="button" variant="ghost" size="icon" className={editor.isActive(tool.name)?'bg-emerald-100 text-emerald-800':''} aria-label={tool.label} title={tool.label} aria-pressed={editor.isActive(tool.name)} disabled={disabled} onClick={tool.run}><tool.icon size={16}/></Button>)}
    <label className="mb-0 flex items-center gap-1 rounded-lg px-2 text-xs" title="Màu chữ"><span>Màu chữ</span><input type="color" aria-label="Màu chữ" className="h-8 w-8 cursor-pointer rounded border p-1" disabled={disabled} value={colorHex(textStyle.color,'#172c28')} onChange={event=>editor.chain().focus().setColor(event.target.value).run()}/></label>
    <label className="mb-0 flex items-center gap-1 rounded-lg px-2 text-xs" title="Tô nền"><span>Tô nền</span><input type="color" aria-label="Màu tô nền" className="h-8 w-8 cursor-pointer rounded border p-1" disabled={disabled} value={colorHex(editor.getAttributes('highlight').color,'#fef08a')} onChange={event=>editor.chain().focus().setHighlight({color:event.target.value}).run()}/></label>
    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={()=>editor.chain().focus().unsetColor().unsetHighlight().unsetBackgroundColor().run()}>Bỏ màu</Button>
    <Button type="button" variant="ghost" size="icon" aria-label="Xóa định dạng" title="Xóa định dạng" disabled={disabled} onClick={()=>editor.chain().focus().unsetAllMarks().clearNodes().resetAttributes('paragraph',['indent','textAlign','lineHeight']).run()}><RemoveFormatting size={16}/></Button>
   </div>
   <div className="flex flex-wrap items-center gap-1 border-t border-slate-200 pt-1">
    {([{value:'left',label:'Căn trái',icon:AlignLeft},{value:'center',label:'Căn giữa',icon:AlignCenter},{value:'right',label:'Căn phải',icon:AlignRight},{value:'justify',label:'Căn đều',icon:AlignJustify}]).map(tool=><Button key={tool.value} type="button" variant="ghost" size="icon" aria-label={tool.label} title={tool.label} aria-pressed={editor.isActive({textAlign:tool.value})} className={editor.isActive({textAlign:tool.value})?'bg-emerald-100 text-emerald-800':''} disabled={disabled} onClick={()=>editor.chain().focus().setTextAlign(tool.value).run()}><tool.icon size={16}/></Button>)}
    <Button type="button" variant="ghost" size="icon" aria-label="Giảm thụt lề" title="Giảm thụt lề" disabled={disabled} onClick={()=>indent(-1)}><IndentDecrease size={16}/></Button><Button type="button" variant="ghost" size="icon" aria-label="Tăng thụt lề" title="Tăng thụt lề" disabled={disabled} onClick={()=>indent(1)}><IndentIncrease size={16}/></Button>
    <span className="mx-1 h-5 border-l border-slate-200" aria-hidden="true"/>
    {blocks.map(tool=><Button key={tool.label} type="button" variant="ghost" size="icon" className={editor.isActive(tool.name)?'bg-emerald-100 text-emerald-800':''} aria-label={tool.label} title={tool.label} aria-pressed={editor.isActive(tool.name)} disabled={disabled} onClick={tool.run}><tool.icon size={16}/></Button>)}
    <Button type="button" variant="ghost" size="icon" aria-label="Chèn đường phân cách" title="Đường phân cách" disabled={disabled} onClick={()=>editor.chain().focus().setHorizontalRule().run()}><Minus size={16}/></Button>
    <Button type="button" variant="ghost" size="icon" aria-label="Thêm hoặc sửa liên kết" title="Liên kết" aria-pressed={editor.isActive('link')} disabled={disabled} onClick={()=>{setLink(editor.getAttributes('link').href??'');setLinkError('');setPanel(panel==='link'?null:'link')}}><Link2 size={16}/></Button>
    {editor.isActive('link')&&<Button type="button" variant="ghost" size="icon" aria-label="Bỏ liên kết" disabled={disabled} onClick={()=>editor.chain().focus().unsetLink().run()}><Unlink size={16}/></Button>}
    <Button type="button" variant="ghost" size="icon" aria-label="Chèn ảnh" title="Chèn ảnh từ URL hoặc thiết bị" disabled={disabled} onClick={()=>{setImageError('');setPanel(panel==='image'?null:'image')}}><ImagePlus size={16}/></Button>
    <span className="mx-1 h-5 border-l border-slate-200" aria-hidden="true"/>
    <Button type="button" variant="ghost" size="icon" aria-label="Hoàn tác" title="Hoàn tác (Ctrl+Z)" disabled={disabled||!editor.can().undo()} onClick={()=>editor.chain().focus().undo().run()}><Undo2 size={16}/></Button><Button type="button" variant="ghost" size="icon" aria-label="Làm lại" title="Làm lại (Ctrl+Shift+Z)" disabled={disabled||!editor.can().redo()} onClick={()=>editor.chain().focus().redo().run()}><Redo2 size={16}/></Button>
   </div>
   <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2" aria-label="Chèn và chỉnh bảng"><span className="text-xs text-slate-500">Bảng</span><input type="number" aria-label="Số hàng bảng" onKeyDown={event=>{if(event.key==='Enter')event.preventDefault()}} min={1} max={20} className="h-8 w-16 rounded-lg px-2 py-1 text-xs" disabled={disabled} value={tableRows} onChange={event=>setTableRows(Math.min(20,Math.max(1,Number(event.target.value)||1)))}/><span className="text-xs text-slate-400">×</span><input type="number" aria-label="Số cột bảng" onKeyDown={event=>{if(event.key==='Enter')event.preventDefault()}} min={1} max={10} className="h-8 w-16 rounded-lg px-2 py-1 text-xs" disabled={disabled} value={tableCols} onChange={event=>setTableCols(Math.min(10,Math.max(1,Number(event.target.value)||1)))}/><Button type="button" variant="outline" size="sm" aria-label="Chèn bảng" disabled={disabled} onClick={()=>editor.chain().focus().insertTable({rows:tableRows,cols:tableCols,withHeaderRow:true}).run()}><Table2 size={15}/>Chèn bảng</Button></div></div>
  </div>
  {panel==='link'&&<div className="grammar-editor-inline-panel space-y-2 border-b bg-slate-50 p-3"><div className="flex flex-wrap gap-2"><Input autoFocus aria-label="Địa chỉ liên kết" placeholder="https://example.com" value={link} disabled={disabled} className="min-w-40 flex-1" onChange={event=>setLink(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();applyLink()}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setPanel(null);editor.commands.focus()}}}/><Button type="button" size="sm" disabled={disabled} onClick={applyLink}>Áp dụng</Button><Button type="button" variant="ghost" size="sm" onClick={()=>setPanel(null)}>Hủy</Button></div>{linkError&&<p role="alert" className="text-xs text-red-600">{linkError}</p>}</div>}
  {panel==='image'&&<div className="grammar-editor-inline-panel space-y-3 border-b bg-slate-50 p-3"><Input autoFocus aria-label="URL ảnh" placeholder="URL ảnh https://…" value={imageUrl} disabled={disabled||imageLoading} onChange={event=>setImageUrl(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')event.preventDefault()}}/><Input aria-label="Mô tả ảnh" placeholder="Mô tả ảnh" value={imageAlt} disabled={disabled||imageLoading} onChange={event=>setImageAlt(event.target.value)} onKeyDown={event=>{if(event.key==='Enter')event.preventDefault()}}/><div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={disabled||imageLoading||!imageUrl.trim()} onClick={()=>{if(!/^https?:\/\/\S+$/i.test(imageUrl.trim())){setImageError('Nhập URL ảnh bắt đầu bằng https:// hoặc http://.');return}insertImage(imageUrl.trim())}}>Chèn URL ảnh</Button><Button type="button" variant="outline" size="sm" disabled={disabled||imageLoading} onClick={()=>imageInput.current?.click()}>{imageLoading?'Đang đọc ảnh…':'Chọn ảnh từ máy'}</Button><Button type="button" variant="ghost" size="sm" onClick={()=>setPanel(null)}>Hủy</Button><input ref={imageInput} className="hidden" type="file" aria-label="Chọn file ảnh" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void uploadImage(file)}}/></div><p className="text-xs text-slate-500">Ảnh từ máy tối đa 750 KB. Kéo góc ảnh để đổi kích thước.</p>{imageError&&<p role="alert" className="text-xs text-red-600">{imageError}</p>}</div>}
  {toolsOpen&&editor.isActive('table')&&<div className="flex shrink-0 gap-1 overflow-x-auto border-b bg-emerald-50/50 p-2 [&>button]:shrink-0" aria-label="Thao tác bảng">{tableActions.map(action=><Button key={action.label} type="button" variant="ghost" size="sm" disabled={disabled||action.can===false} className={action.label==='Xóa bảng'?'text-red-600':''} onClick={action.run}>{action.label}</Button>)}</div>}
  <EditorContent editor={editor} className="grammar-editor-content min-h-0 flex-1 overflow-auto overscroll-contain"/>
  <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-slate-50 px-3 py-2 text-xs text-slate-400"><span>{editor.getText().trim().split(/\s+/).filter(Boolean).length} từ · {editor.getText().length} ký tự</span><span>Ctrl+Z · Hoàn tác</span></div>
 </div>
}
