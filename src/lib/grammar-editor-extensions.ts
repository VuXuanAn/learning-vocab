import { Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TableKit } from '@tiptap/extension-table'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import { TextStyleKit } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { TaskList, TaskItem } from '@tiptap/extension-list'

const Indent=Extension.create({
 name:'grammarIndent',
 addGlobalAttributes(){return [{types:['paragraph','heading'],attributes:{indent:{
  default:0,
  parseHTML:element=>element.style.marginLeft.endsWith('em')?Math.min(8,Math.max(0,parseFloat(element.style.marginLeft)/2||0)):0,
  renderHTML:attributes=>attributes.indent?{style:'margin-left: '+Math.min(8,Math.max(0,Number(attributes.indent))) * 2+'em'}:{},
 }}}]},
})
export function grammarEditorExtensions(){return [
 StarterKit.configure({link:{openOnClick:false,HTMLAttributes:{target:null,rel:null}}}),
 TableKit.configure({table:{resizable:true}}),Superscript,Subscript,
 TextStyleKit.configure({lineHeight:{types:['textStyle','paragraph','heading']}}),
 TextAlign.configure({types:['heading','paragraph']}),Highlight.configure({multicolor:true}),
 Image.configure({allowBase64:true,resize:{enabled:true,directions:['top-left','top-right','bottom-left','bottom-right'],alwaysPreserveAspectRatio:true}}),
 TaskList,TaskItem.configure({nested:true}),Indent,
]}
