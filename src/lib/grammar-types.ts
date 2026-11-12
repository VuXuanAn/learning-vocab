import type { GrammarSource } from './reading-grammar'
export interface GrammarDocument {
 name:string
 level:string
 structures:{id:number;type:string;formula:string}[]
 usages:{id:number;content:string}[]
 examples:{id:number;en:string;vi:string}[]
 notes:string
}
export interface GrammarEntry {
 name?:string
 category?:string
 level?:string
 structures?:GrammarDocument['structures']
 usages?:GrammarDocument['usages']
 examples?:GrammarDocument['examples']
 sources?:GrammarSource[]
 source?:GrammarSource
 id:string
 ownerId:string
 folderId:string
 title:string
 topic:string
 structure:string
 usage:string
 example:string
 translation:string
 notes:string

 createdAt:string
 updatedAt:string
}

export interface GrammarFolder {
 parentId?:string
 id:string
 ownerId:string
 name:string
 nameKey:string
 createdAt:string
 updatedAt:string
}
