import {test} from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {resolveSafePath, contentTypeFor} from './serve.mjs'

const root = path.resolve('/srv/dist')

test('通常のパスを解決する', () => {
  assert.equal(resolveSafePath(root, '/lessons/01-first-ar/index.html'),
    path.join(root, 'lessons', '01-first-ar', 'index.html'))
})

test('ディレクトリ指定は index.html を返す', () => {
  assert.equal(resolveSafePath(root, '/lessons/01-first-ar/'),
    path.join(root, 'lessons', '01-first-ar', 'index.html'))
})

test('ルートは index.html を返す', () => {
  assert.equal(resolveSafePath(root, '/'), path.join(root, 'index.html'))
})

test('親ディレクトリへの脱出を拒否する', () => {
  assert.equal(resolveSafePath(root, '/../../etc/passwd'), null)
})

test('エンコードされた脱出も拒否する', () => {
  assert.equal(resolveSafePath(root, '/%2e%2e/%2e%2e/etc/passwd'), null)
})

test('クエリ文字列を無視する', () => {
  assert.equal(resolveSafePath(root, '/index.html?v=1'), path.join(root, 'index.html'))
})

test('拡張子から Content-Type を決める', () => {
  assert.equal(contentTypeFor('a.html'), 'text/html; charset=utf-8')
  assert.equal(contentTypeFor('a.js'), 'text/javascript; charset=utf-8')
  assert.equal(contentTypeFor('a.glb'), 'model/gltf-binary')
})

test('未知の拡張子は octet-stream にする', () => {
  assert.equal(contentTypeFor('a.unknown'), 'application/octet-stream')
})
