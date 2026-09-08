import {test} from 'node:test'
import assert from 'node:assert/strict'
import {renderIndex} from './build.mjs'

const lessons = [
  {id: '00-about', title: 'このコースについて', dir: 'lessons/00-about', mode: 'prose', status: 'published'},
  {id: '01-first-ar', title: '最初の AR', dir: 'lessons/01-first-ar', mode: 'static', status: 'published'},
]

test('索引に全レッスンのタイトルが出る', () => {
  const html = renderIndex(lessons)
  assert.match(html, /このコースについて/)
  assert.match(html, /最初の AR/)
})

test('static レッスンは index.html へリンクする', () => {
  assert.match(renderIndex(lessons), /href="\.\/lessons\/01-first-ar\/"/)
})

test('prose レッスンは README.md へリンクする', () => {
  assert.match(renderIndex(lessons), /href="\.\/lessons\/00-about\/README\.md"/)
})

test('日本語ページとして lang と charset を宣言する', () => {
  const html = renderIndex(lessons)
  assert.match(html, /<html lang="ja">/)
  assert.match(html, /charset="utf-8"/i)
})

test('タイトルに含まれる HTML 特殊文字をエスケープする', () => {
  const html = renderIndex([{...lessons[0], title: '<script>alert(1)</script>'}])
  assert.doesNotMatch(html, /<script>alert/)
  assert.match(html, /&lt;script&gt;/)
})

test('レッスンが空でも壊れない', () => {
  assert.match(renderIndex([]), /<html lang="ja">/)
})
