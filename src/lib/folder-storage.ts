import type { Note } from './cards'
import { db } from './db'

export async function saveNotesToFolder(notes: Note[], folderId: string) {
  if (!folderId || folderId === 'all' || notes.some(note => note.folderId !== folderId)) throw new Error('Hãy chọn thư mục trước khi lưu.')
  await db.transaction('rw', db.notes, db.folders, async () => {
    if (!await db.folders.get(folderId)) throw new Error('Thư mục đã bị xóa. Hãy chọn thư mục khác.')
    await db.notes.bulkAdd(notes)
  })
}
export async function deleteEmptyFolder(folderId: string) {
  await db.transaction('rw', db.notes, db.folders, async () => {
    const folder = await db.folders.get(folderId)
    if (!folder) return
    if (await db.notes.where('folderId').equals(folderId).count()) throw new Error('Thư mục còn từ vựng. Hãy chuyển từ sang thư mục khác trước khi xóa.')
    await db.folders.filter(child => child.parentId === folderId).modify({ parentId: folder.parentId ?? '' })
    await db.folders.delete(folderId)
  })
}
