import { z } from 'zod'
import { db, type VocabDatabase } from './db'
import type { GrammarEntry, GrammarFolder } from './grammar-types'
import { cleanGrammarDocument } from './grammar-document'
import { sortGrammarItems } from './grammar-order'
const sourceSchema=z.object({exactSelection:z.boolean().optional(),articleId:z.string().uuid(),articleTitle:z.string().max(160),contentHtml:z.string().max(200000),quote:z.string().min(1).max(10000),start:z.number().int().min(0),end:z.number().int().min(1),highlights:z.array(z.object({start:z.number().int().min(0),end:z.number().int().min(1)})).min(1).max(10000)})
const schema=z.object({source:sourceSchema.optional(),sources:z.array(sourceSchema).max(1000).optional(),id:z.string().uuid(),ownerId:z.string().min(1),folderId:z.string().uuid(),title:z.string().trim().min(1).max(160),topic:z.string().trim().max(100),structure:z.string().trim().min(1).max(5000),usage:z.string().trim().max(20000),example:z.string().trim().max(10000),translation:z.string().trim().max(10000),notes:z.string().trim().max(20000),createdAt:z.string(),updatedAt:z.string()})
export async function saveGrammarEntry(row:GrammarEntry,account:VocabDatabase=db){
 const structuredSchema=schema.extend({
  sortOrder:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  structure:z.string().trim().min(1).max(153030),usage:z.string().trim().max(1000050),example:z.string().trim().max(500050),translation:z.string().trim().max(500050),
  name:z.string().trim().min(1).max(160).optional(),category:z.string().trim().max(100).optional(),level:z.enum(['','A1','A2','B1','B2','C1','C2']).optional(),
  structures:z.array(z.object({id:z.number().int().positive(),type:z.string().trim().max(100),formula:z.string().trim().min(1,'Nhập công thức ngữ pháp.').max(5000)})).min(1,'Thêm ít nhất một cấu trúc.').max(30).optional(),
  usages:z.array(z.object({id:z.number().int().positive(),content:z.string().trim().min(1).max(20000)})).max(50).optional(),
  examples:z.array(z.object({id:z.number().int().positive(),en:z.string().trim().min(1,'Nhập câu ví dụ tiếng Anh.').max(10000),vi:z.string().trim().max(10000)})).max(50).optional(),
 })
 const prepared=row.structures||row.usages||row.examples?cleanGrammarDocument(row):row
 const result=structuredSchema.safeParse({...prepared,updatedAt:new Date().toISOString()})
 if(!result.success)throw new Error(result.error.issues.map(issue=>issue.message).join(' '))
 const parsed=result.data
 for(const rows of [parsed.structures,parsed.usages,parsed.examples])if(rows&&new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('ID trong mỗi danh sách phải khác nhau.')
 return account.transaction('rw',account.grammarEntries,account.grammarFolders,account.readingArticles,async()=>{
  const folder=await account.grammarFolders.get(parsed.folderId)
  if(!folder||folder.ownerId!==parsed.ownerId)throw new Error('Hãy chọn thư mục Grammar của bạn.')
  const previous=await account.grammarEntries.get(parsed.id)
  const previousSources=[...(previous?.source?[previous.source]:[]),...(previous?.sources??[])]
  for(const source of [...(parsed.source?[parsed.source]:[]),...(parsed.sources??[])]){
   if(previousSources.some(saved=>JSON.stringify(saved)===JSON.stringify(source)))continue
   const article=await account.readingArticles.get(source.articleId)
   if(!article||article.deletedAt||article.ownerId!==parsed.ownerId||article.contentHtml!==source.contentHtml)throw new Error('Bài đọc đã thay đổi hoặc không còn tồn tại. Hãy chọn lại đoạn ngữ pháp.')
   if(source.end-source.start!==source.quote.length||source.highlights.some(range=>range.start<source.start||range.end>source.end||range.end<=range.start))throw new Error('Vị trí tô sáng không hợp lệ.')
  }
  if(previous&&previous.ownerId!==parsed.ownerId)throw new Error('Không có quyền sửa cấu trúc này.')
  if(previous&&previous.updatedAt!==row.updatedAt)throw new Error('Cấu trúc đã thay đổi. Hãy đóng và mở lại để sửa.')
  await account.grammarEntries.put(parsed);return parsed
 })
}
export async function deleteGrammarEntry(row:GrammarEntry,account:VocabDatabase=db){
 return account.transaction('rw',account.grammarEntries,async()=>{
  const current=await account.grammarEntries.get(row.id)
  if(!current||current.ownerId!==row.ownerId)throw new Error('Không có quyền xóa cấu trúc này.')
  if(current.updatedAt!==row.updatedAt)throw new Error('Cấu trúc đã thay đổi. Hãy mở lại trước khi xóa.')
  await account.grammarEntries.delete(row.id)
 })
}
const folderSchema=z.object({sortOrder:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),parentId:z.string().uuid().optional(),id:z.string().uuid(),ownerId:z.string().min(1),name:z.string().trim().min(1).max(100),nameKey:z.string(),createdAt:z.string(),updatedAt:z.string()})
export async function saveGrammarFolder(row:GrammarFolder,account:VocabDatabase=db){
 const parsed=folderSchema.parse({...row,parentId:row.parentId||undefined,nameKey:row.name.trim().toLocaleLowerCase('vi'),updatedAt:new Date().toISOString()})
 return account.transaction('rw',account.grammarFolders,async()=>{
  const current=await account.grammarFolders.get(parsed.id)
  if(current&&current.ownerId!==parsed.ownerId)throw new Error('Không có quyền sửa thư mục này.')
  if(current&&current.updatedAt!==row.updatedAt)throw new Error('Thư mục đã thay đổi. Hãy mở lại để sửa.')
  const owned=await account.grammarFolders.where('ownerId').equals(parsed.ownerId).toArray()
  let parentId=parsed.parentId;const visited=new Set([parsed.id])
  while(parentId){
   if(visited.has(parentId))throw new Error('Không thể đặt thư mục vào chính nó hoặc thư mục con của nó.')
   visited.add(parentId)
   const parent=owned.find(folder=>folder.id===parentId)
   if(!parent)throw new Error('Hãy chọn thư mục cha Grammar của bạn.')
   parentId=parent.parentId
  }
  if(owned.some(folder=>folder.id!==parsed.id&&folder.nameKey===parsed.nameKey&&(folder.parentId||undefined)===parsed.parentId))throw new Error('Tên thư mục đã tồn tại.')
 await account.grammarFolders.put(parsed);return parsed
 })
}
export async function deleteGrammarFolder(row:GrammarFolder,account:VocabDatabase=db){
 await account.transaction('rw',account.grammarEntries,account.grammarFolders,async()=>{
  const current=await account.grammarFolders.get(row.id)
  if(!current||current.ownerId!==row.ownerId)throw new Error('Không có quyền xóa thư mục này.')
  if(current.updatedAt!==row.updatedAt)throw new Error('Thư mục đã thay đổi. Hãy mở lại trước khi xóa.')
  if(await account.grammarEntries.where('folderId').equals(row.id).count())throw new Error('Thư mục còn cấu trúc. Hãy chuyển cấu trúc sang thư mục khác trước khi xóa.')
  await account.grammarFolders.filter(child=>child.ownerId===row.ownerId&&child.parentId===row.id).modify({parentId:current.parentId,updatedAt:new Date().toISOString()})
  await account.grammarFolders.delete(row.id)
 })
}

export async function moveGrammarItem(table:'grammarFolders'|'grammarEntries',id:string,target:string|-1|1,ownerId:string,account:VocabDatabase=db){
 return account.transaction('rw',account[table],async()=>{
  const current=await account[table].get(id)
  if(!current||current.ownerId!==ownerId)throw new Error('Không có quyền sắp xếp mục này.')
  const owned=await account[table].where('ownerId').equals(ownerId).toArray()
  const siblings=sortGrammarItems(owned.filter(row=>table==='grammarFolders'
   ? ((row as GrammarFolder).parentId||'')===((current as GrammarFolder).parentId||'')
   : (row as GrammarEntry).folderId===(current as GrammarEntry).folderId),table==='grammarEntries')
  const from=siblings.findIndex(row=>row.id===id),to=typeof target==='string'?siblings.findIndex(row=>row.id===target):from+target
  if(typeof target==='string'&&to<0)throw new Error('Chỉ sắp xếp các mục trong cùng thư mục hoặc cùng cấp.')
  if(to<0||to>=siblings.length)return false
  if(from===to)return false
  const [moved]=siblings.splice(from,1);siblings.splice(to,0,moved)
  const updatedAt=new Date(Math.max(Date.now(),...siblings.map(row=>Date.parse(row.updatedAt)+1))).toISOString()
  for(const [sortOrder,row] of siblings.entries())if(row.sortOrder!==sortOrder){
   await account[table].update(row.id,{sortOrder,updatedAt})
  }
  return true
 })
}
