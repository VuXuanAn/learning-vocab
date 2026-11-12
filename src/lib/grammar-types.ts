import type { GrammarSource } from './reading-grammar'
export interface GrammarEntry {
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
 status:'review'|'learned'
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
