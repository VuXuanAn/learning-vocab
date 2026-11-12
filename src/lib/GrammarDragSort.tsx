import { useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type CollisionDetection, type KeyboardCoordinateGetter } from '@dnd-kit/core'
import { SortableContext, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { GripVertical } from 'lucide-react'
import { TableRow } from '@/components/ui/table'

const collision:CollisionDetection=args=>closestCenter({...args,droppableContainers:args.droppableContainers.filter(container=>container.data.current?.group===args.active.data.current?.group)})
const keyboardCoordinates:KeyboardCoordinateGetter=(event,args)=>{
 const {context}=args,group=context.active?.data.current?.group
 const rects=new Map([...context.droppableRects].filter(([id])=>context.droppableContainers.get(id)?.data.current?.group===group))
 return sortableKeyboardCoordinates(event,{...args,context:{...context,droppableRects:rects}})
}

export function GrammarDragSort({items,onMove,children}:{items:string[];onMove:(id:string,target:string)=>void;children:ReactNode}){
 const [label,setLabel]=useState('')
 const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:6}}),useSensor(KeyboardSensor,{coordinateGetter:keyboardCoordinates}))
 return <DndContext sensors={sensors} collisionDetection={collision} accessibility={{screenReaderInstructions:{draggable:'Nhấn Space để bắt đầu kéo. Dùng phím mũi tên để di chuyển. Nhấn Space để thả hoặc Escape để hủy.'}}} onDragStart={({active})=>setLabel(active.data.current?.label??'')} onDragCancel={()=>setLabel('')} onDragEnd={({active,over})=>{
  setLabel('')
  if(over&&active.id!==over.id&&active.data.current?.group===over.data.current?.group)onMove(String(active.id),String(over.id))
 }}><SortableContext items={items}>{children}</SortableContext><DragOverlay dropAnimation={null}>{label&&<div className="flex max-w-lg items-center gap-2 rounded-xl border border-emerald-400 bg-white p-4 text-sm font-semibold text-emerald-900 shadow-xl"><GripVertical size={18}/><span className="truncate">{label}</span></div>}</DragOverlay></DndContext>
}

export function GrammarSortableRow({id,group,label,disabled,children,className}:{id:string;group:string;label:string;disabled:boolean;children:(handle:ReactNode)=>ReactNode;className?:string}){
 const {setNodeRef,setActivatorNodeRef,attributes,listeners,isDragging,isOver,active}=useSortable({id,data:{group,label},disabled})
 const handle=<button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} disabled={disabled} aria-label={'Kéo để sắp xếp '+label} title="Kéo để sắp xếp" className="flex size-8 shrink-0 touch-none items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-default disabled:opacity-30 cursor-grab active:cursor-grabbing"><GripVertical size={17}/></button>
 return <TableRow ref={setNodeRef} className={(className??'')+(isDragging?' opacity-30':'')+(isOver&&active?.id!==id?' bg-emerald-50 outline-2 outline-emerald-500 -outline-offset-2':'')}>{children(handle)}</TableRow>
}
