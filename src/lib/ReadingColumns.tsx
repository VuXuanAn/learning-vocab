import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
const defaults=[37.5,37.5,25]
export default function ReadingColumns({children,pane,notesHidden}:{children:ReactNode[];pane:string;notesHidden:boolean}){
 const root=useRef<HTMLDivElement>(null)
 const [widths,setWidths]=useState<number[]>(()=>{
  try{const saved=JSON.parse(localStorage.getItem('reading-pane-widths-v2')??'null');if(Array.isArray(saved)&&saved.length===3&&saved.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=15)&&Math.abs(saved.reduce((a,b)=>a+b,0)-100)<0.1)return saved}catch{/* Use default widths if storage is unavailable. */}
  return defaults
 })
 function update(index:number,delta:number,initial=widths){
  const next=[...initial],change=Math.max(15-initial[index],Math.min(initial[index+1]-15,delta))
  next[index]+=change;next[index+1]-=change;setWidths(next)
  try{localStorage.setItem('reading-pane-widths-v2',JSON.stringify(next))}catch{/* Resizing still works without persistence. */}
 }
 function separator(index:number){return <div role="separator" aria-orientation="vertical" aria-label={index===0?'Đổi độ rộng Nội dung và Dịch':'Đổi độ rộng Dịch và Ghi chú'} aria-valuemin={15} aria-valuemax={widths[index]+widths[index+1]-15} aria-valuenow={Math.round(widths[index])} tabIndex={0} title="Kéo để đổi độ rộng; dùng phím mũi tên khi chọn thanh này" className="reading-resizer" onKeyDown={event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();update(index,event.key==='ArrowLeft'?-2:2)}}} onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drag.current={index,start:event.clientX,initial:[...widths]}}} onPointerMove={event=>{const current=drag.current;if(!current)return;const width=(root.current?.clientWidth??0)-(notesHidden?68:24),units=notesHidden?current.initial[0]+current.initial[1]:100;if(width>0)update(current.index,(event.clientX-current.start)/width*units,current.initial)}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}}><span/></div>}
 const drag=useRef<{index:number;start:number;initial:number[]}|null>(null)
 return <div ref={root} data-mobile-pane={pane} data-notes-hidden={notesHidden} className="reading-columns grid min-h-0 flex-1" style={{'--reading-width-0':widths[0]+'fr','--reading-width-1':widths[1]+'fr','--reading-width-2':widths[2]+'fr'} as CSSProperties}>{children[0]}{separator(0)}{children[1]}{!notesHidden&&separator(1)}{children[2]}</div>
}
