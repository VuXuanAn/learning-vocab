import type { Flashcard, Note } from './cards'
import { matchesMeaning } from './meaning-quiz'
export interface TypedTarget { kind: 'word' | 'meaning' | 'cloze'; expected: string }
const fieldKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('vi')
export function typedTarget(note:Note, card:Flashcard, reversed:boolean):TypedTarget|null {
 if(note.kind==='cloze'){
  if(reversed)return null
  const group=card.id.slice((note.id+'-c').length)
  const answers=[...note.front.matchAll(/\{\{c([1-9]\d*)::([^{}]+?)\}\}/g)].filter(match=>match[1]===group).map(match=>match[2].split('::')[0].trim())
  return answers.length?{kind:'cloze',expected:answers.join(' ; ')}:null
 }
 if(note.template){
  const fields=note.template.fields
  const wordField=fields.find(field=>/^(tu vung|word|term|vocabulary)$/.test(fieldKey(field.name)))
  const meaningField=fields.find(field=>/nghia|meaning|definition/.test(fieldKey(field.name)))
  if(!wordField||!meaningField)return null
  const expected=note.values?.[reversed?wordField.name:meaningField.name]?.trim()
  return expected?{kind:reversed?'word':'meaning',expected}:null
 }
 const expectsWord=(card.id===note.id+'-reverse')!==reversed
 return card.back.trim()?{kind:expectsWord?'word':'meaning',expected:card.back.trim()}:null
}
export function normalizeTypedWord(value:string){
 return value.normalize('NFKC').toLocaleLowerCase('en').replace(/[’‘]/g,"'").replace(/[.!?]+$/g,'').replace(/\s+/gu,' ').trim()
}
export function checkTypedAnswer(answer:string,target:TypedTarget){
 if(target.kind==='meaning')return matchesMeaning(answer,target.expected)
 if(target.kind==='cloze'){
  const entered=answer.split(/[;\n]+/).map(normalizeTypedWord)
  const expected=target.expected.split(' ; ').map(normalizeTypedWord)
  return entered.length===expected.length&&entered.every((value,index)=>!!value&&value===expected[index])
 }
 return !!answer.trim()&&normalizeTypedWord(answer)===normalizeTypedWord(target.expected)
}
