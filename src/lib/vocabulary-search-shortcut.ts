export function bindVocabularySearchShortcut(target: Window, toggle: () => void) {
 const handle = (event: KeyboardEvent) => {
  // Physical key codes keep this shortcut working with Vietnamese input methods.
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || (event.code !== 'KeyD' && event.key.toLowerCase() !== 'd')) return
  event.preventDefault()
  if (!event.repeat) toggle()
 }
 target.addEventListener('keydown', handle, true)
 return () => target.removeEventListener('keydown', handle, true)
}
