import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
const source=readFileSync(new URL('../src/lib/review-shortcuts.ts',import.meta.url),'utf8')
const {reviewShortcut}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'))
const state={hasCard:true,hasSeenAnswer:true,busy:false,editing:false,dialog:false}
test('1-4 map to the four grades remain available after first reveal even when flipped back',()=>{
 for(const key of ['1','2','3','4']){
  assert.equal(reviewShortcut({key},state),Number(key))
  assert.equal(reviewShortcut({key},{...state,hasSeenAnswer:false}),null)
 }
 assert.equal(reviewShortcut({key:'5'},state),null)
})
test('shortcut guards stop double presses, composing, modifiers and popups',()=>{
 for(const patch of [{repeat:true},{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}])assert.equal(reviewShortcut({key:'1',...patch},state),null)
 for(const patch of [{hasCard:false},{busy:true},{editing:true},{dialog:true}])assert.equal(reviewShortcut({key:'2'},{...state,...patch}),null)
})
test('Space flips both directions without grading or repeating while held',()=>{
 assert.equal(reviewShortcut({key:' '},{...state,hasSeenAnswer:false}),'flip')
 assert.equal(reviewShortcut({key:' '},state),'flip')
 assert.equal(reviewShortcut({key:' ',repeat:true},{...state,hasSeenAnswer:false}),null)
})

test('S plays speech and respects typing, dialogs and modifier guards',()=>{
 assert.equal(reviewShortcut({key:'s'},state),'speak')
 assert.equal(reviewShortcut({key:'S'},state),'speak')
 for(const patch of [{editing:true},{dialog:true},{busy:true},{hasCard:false}]) assert.equal(reviewShortcut({key:'s'},{...state,...patch}),null)
 for(const patch of [{repeat:true},{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true}]) assert.equal(reviewShortcut({key:'s',...patch},state),null)
})
