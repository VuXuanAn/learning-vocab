import { Children, Fragment, isValidElement, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
interface Option {value:string;label:string;disabled?:boolean}
function text(children:ReactNode):string{return Children.toArray(children).map(child=>isValidElement<{children?:ReactNode}>(child)?text(child.props.children):String(child)).join('')}
function options(children:ReactNode):Option[]{
 const result:Option[]=[]
 Children.forEach(children,child=>{
  if(!isValidElement<{value?:string|number;children?:ReactNode;disabled?:boolean}>(child))return
  if(child.type==='option')result.push({value:String(child.props.value??text(child.props.children)),label:text(child.props.children),disabled:child.props.disabled})
  else if(child.type===Fragment||child.type==='optgroup')result.push(...options(child.props.children))
 });return result
}
type Props=Omit<SelectHTMLAttributes<HTMLSelectElement>,'onChange'|'value'|'defaultValue'|'multiple'|'size'> & {value?:string|number;onChange?:(event:{target:{value:string};currentTarget:{value:string}})=>void}
/** Shared single-choice dropdown; keeps existing option lists and value handlers. */
export default function StyledSelect({children,value,onChange,id,name,required,disabled,className,style,'aria-label':ariaLabel,'aria-labelledby':labelledBy,'aria-describedby':describedBy,...rest}:Props){
 const rows=options(children),placeholder=rows.find(row=>row.value===''&&row.disabled)
 const selected=value===undefined||value===null||value===''&&placeholder?null:String(value)
 return <Select value={selected} onValueChange={next=>{const target={value:next??''};onChange?.({target,currentTarget:target})}} items={rows} name={name} required={required} disabled={disabled}><SelectTrigger id={id} aria-label={ariaLabel} aria-labelledby={labelledBy} aria-describedby={describedBy} title={rest.title} style={style} className={'h-10 w-full min-w-0 border-slate-200 bg-white px-3.5 text-slate-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/30 focus-visible:border-emerald-600 focus-visible:ring-2 focus-visible:ring-emerald-600/15 data-popup-open:border-emerald-600 data-popup-open:ring-2 data-popup-open:ring-emerald-600/15 '+(className??'')}><SelectValue placeholder={placeholder?.label??'Chọn một mục'} className="min-w-0 truncate text-sm"/></SelectTrigger><SelectContent align="start" alignItemWithTrigger={false} sideOffset={8} className="max-h-[min(20rem,var(--available-height))] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 ring-0">{rows.filter(row=>row!==placeholder).map(row=><SelectItem key={row.value} value={row.value} label={row.label} disabled={row.disabled} className="min-h-10 cursor-pointer rounded-lg py-2 pl-3 pr-9 text-slate-600 transition-colors data-highlighted:bg-emerald-50 data-highlighted:text-emerald-800 data-selected:bg-emerald-50/70 data-selected:font-medium data-selected:text-emerald-800 focus:bg-emerald-50 focus:text-emerald-800"><span className="min-w-0 truncate" title={row.label}>{row.label}</span></SelectItem>)}</SelectContent></Select>
}
