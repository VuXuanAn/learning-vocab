import type { GrammarFolder } from './grammar-types'
export function grammarFolderIds(id:string,folders:GrammarFolder[]){
 const ids=new Set([id])
 let changed=true
 while(changed){changed=false;for(const folder of folders)if(folder.parentId&&ids.has(folder.parentId)&&!ids.has(folder.id)){ids.add(folder.id);changed=true}}
 return ids
}
export function grammarFolderRows(folders:GrammarFolder[],collapsed=new Set<string>()){
 const children=new Map<string,GrammarFolder[]>(),ids=new Set(folders.map(folder=>folder.id))
 for(const folder of folders){const parent=folder.parentId&&ids.has(folder.parentId)?folder.parentId:'';const list=children.get(parent)??[];list.push(folder);children.set(parent,list)}
 const rows:{folder:GrammarFolder;depth:number;hasChildren:boolean}[]=[],visited=new Set<string>()
 function visit(folder:GrammarFolder,depth:number,hidden=false){
  if(visited.has(folder.id))return
  visited.add(folder.id);const nested=children.get(folder.id)??[]
  if(!hidden)rows.push({folder,depth,hasChildren:!!nested.length})
  for(const child of nested)visit(child,depth+1,hidden||collapsed.has(folder.id))
 }
 for(const folder of children.get('')??[])visit(folder,0)
 for(const folder of folders)if(!visited.has(folder.id))visit(folder,0)
 return rows
}
export function grammarFolderPath(id:string,folders:GrammarFolder[]){
 const path:GrammarFolder[]=[],visited=new Set<string>();let current=folders.find(folder=>folder.id===id)
 while(current&&!visited.has(current.id)){visited.add(current.id);path.unshift(current);current=folders.find(folder=>folder.id===current?.parentId)}
 return path
}
