import type { GrammarDocument, GrammarEntry } from './grammar-types'

export function grammarDocument(entry:GrammarEntry):GrammarDocument {
 return {
  name:entry.name??entry.title, level:entry.level??'',
  structures:entry.structures??(entry.structure?.trim()?[{id:1,type:'',formula:entry.structure}]:[]),
  usages:entry.usages??[{id:1,content:entry.usage}],
  examples:entry.examples??[{id:1,en:entry.example,vi:entry.translation}], notes:entry.notes,
 }
}
export function withGrammarDocument(entry:GrammarEntry,document:GrammarDocument):GrammarEntry {
 return {...withoutLegacyStructure(entry),...document,title:document.name,
  usage:document.usages.map(row=>row.content).filter(Boolean).join('\n'),
  example:document.examples.map(row=>row.en).filter(Boolean).join('\n'),
  translation:document.examples.map(row=>row.vi).filter(Boolean).join('\n')}
}
export function cleanGrammarDocument(entry:GrammarEntry):GrammarEntry {
 const document=grammarDocument(entry)
 return withGrammarDocument(entry,{...document,name:document.name.trim(),
  structures:document.structures.map(row=>({...row,type:row.type.trim(),formula:row.formula.trim()})).filter(row=>row.type||row.formula),
  usages:document.usages.map(row=>({...row,content:row.content.trim()})).filter(row=>row.content),
  examples:document.examples.map(row=>({...row,en:row.en.trim(),vi:row.vi.trim()})).filter(row=>row.en||row.vi),notes:document.notes.trim()})
}


// Keep legacy formulas and Reading keywords while dropping the obsolete summary field.
export function withoutLegacyStructure(entry:GrammarEntry):GrammarEntry {
 const {structure,...current}=entry
 if(!structure?.trim())return current
 return {...current,structures:current.structures??[{id:1,type:'',formula:structure}],
  ...(current.source?{source:{...current.source,pattern:current.source.pattern??structure}}:{}),
  ...(current.sources?{sources:current.sources.map(source=>({...source,pattern:source.pattern??structure}))}:{}),
 }
}
