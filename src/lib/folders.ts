import type { Note } from './cards'
export interface VocabularyFolder { id: string; name: string; nameKey: string; createdAt: number; parentId?: string; reverseCards?: boolean; ownerId?: string; permission?: 'owner' | 'editor' | 'viewer' }
export function folderIds(folderId: string, folders: VocabularyFolder[] = []) {
  const ids = new Set([folderId])
  let changed = true
  while (changed) {
    changed = false
    for (const folder of folders) if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) { ids.add(folder.id); changed = true }
  }
  return ids
}
export function filterNotesByFolder(notes: Note[], folderId: string, folders: VocabularyFolder[] = []) {
  if (folderId === 'all') return notes
  const ids = folderId ? folderIds(folderId, folders) : new Set([''])
  return notes.filter(note => ids.has(note.folderId || ''))
}
export function folderRows(folders: VocabularyFolder[], collapsed: Set<string>) {
  const rows: { folder: VocabularyFolder; depth: number; hasChildren: boolean }[] = []
  const visited = new Set<string>()
  function visit(folder: VocabularyFolder, depth: number) {
    if (visited.has(folder.id)) return
    visited.add(folder.id)
    const children = folders.filter(child => child.parentId === folder.id)
    rows.push({ folder, depth, hasChildren: children.length > 0 })
    if (!collapsed.has(folder.id)) children.forEach(child => visit(child, depth + 1))
    else children.forEach(function mark(child) { if (visited.has(child.id)) return; visited.add(child.id); folders.filter(item => item.parentId === child.id).forEach(mark) })
  }
  folders.filter(folder => !folder.parentId || !folders.some(parent => parent.id === folder.parentId)).forEach(folder => visit(folder, 0))
  folders.filter(folder => !visited.has(folder.id)).forEach(folder => visit(folder, 0))
  return rows
}
export function folderPath(folderId: string, folders: VocabularyFolder[]) {
  const path: VocabularyFolder[] = []
  const visited = new Set<string>()
  let current = folders.find(folder => folder.id === folderId)
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    path.unshift(current)
    current = folders.find(folder => folder.id === current?.parentId)
  }
  return path
}
