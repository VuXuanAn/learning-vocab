import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
const source = stripTypeScriptTypes(await readFile(new URL('../src/lib/google-auth.ts', import.meta.url), 'utf8'))
const { googleSignInOptions } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
test('Google OAuth redirects to app settings on the current origin', () => {
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:4100', 'https://vocab.example.com']) {
    const config = googleSignInOptions(origin)
    assert.equal(config.provider, 'google')
    assert.equal(config.options.redirectTo, origin + '/folders')
    assert.equal(config.options.queryParams.prompt, 'select_account')
    assert.equal(config.options.queryParams.include_granted_scopes, 'true')
  }
})
test('Google OAuth rejects non-web origins', () => {
  assert.throws(() => googleSignInOptions('file:///tmp/app'))
  assert.throws(() => googleSignInOptions('invalid'))
})
