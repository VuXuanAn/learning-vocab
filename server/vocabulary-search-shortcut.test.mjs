import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { JSDOM } from 'jsdom'
const source = stripTypeScriptTypes(readFileSync('src/lib/vocabulary-search-shortcut.ts', 'utf8'))
const { bindVocabularySearchShortcut } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

test('Ctrl D toggles open and closed, cancels browser action, and handles Vietnamese IME', () => {
 const dom = new JSDOM('<input/>')
 let open = false, calls = 0
 const unbind = bindVocabularySearchShortcut(dom.window, () => { open = !open; calls++ })
 const press = patch => {
  const event = new dom.window.KeyboardEvent('keydown', { key: 'd', code: 'KeyD', ctrlKey: true, shiftKey: false, bubbles: true, cancelable: true, ...patch })
  dom.window.document.querySelector('input').dispatchEvent(event)
  return event
 }
 try {
  assert.equal(press({}).defaultPrevented, true)
  assert.equal(open, true)
  press({})
  assert.equal(open, false)
  press({ key: 'Process', isComposing: true })
  assert.equal(open, true)
  assert.equal(press({ repeat: true }).defaultPrevented, true)
  assert.equal(calls, 3)
  for (const patch of [{ shiftKey: true }, { ctrlKey: false }, { altKey: true }, { key: 'A', code: 'KeyA' }]) {
   assert.equal(press(patch).defaultPrevented, false)
  }
  assert.equal(calls, 3)
  press({ ctrlKey: false, metaKey: true })
  assert.equal(open, false)
  unbind()
  press({})
  assert.equal(calls, 4)
 } finally { unbind(); dom.window.close() }
})
