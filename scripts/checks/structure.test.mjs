import {test} from 'node:test'
import assert from 'node:assert/strict'
import {checkHeadings, checkFooter, LESSON_HEADINGS} from './structure.mjs'

const validLesson = `# L01 最初の AR

## このレッスンでできるようになること
- カメラを起動できる

## 前提
なし

## まず動かす
手順

## 解説
本文

## つまずきポイント
症状 → 原因 → 対処

---
検証：2026-09-08 / Android Chrome 140 / engine 1.2.3
`

test('必須見出しが揃っていればエラーなし', () => {
  assert.deepEqual(checkHeadings(validLesson, 'static'), [])
})

test('見出しが欠けていれば、欠けたものだけ報告する', () => {
  const broken = validLesson.replace('## つまずきポイント\n', '')
  const errors = checkHeadings(broken, 'static')
  assert.equal(errors.length, 1)
  assert.match(errors[0], /つまずきポイント/)
})

test('必須見出しは 5 つである', () => {
  assert.equal(LESSON_HEADINGS.length, 5)
})

test('prose モードは H1 だけを要求する', () => {
  assert.deepEqual(checkHeadings('# L00 このコースについて\n\n本文', 'prose'), [])
})

test('prose モードで H1 が無ければエラー', () => {
  const errors = checkHeadings('本文だけ', 'prose')
  assert.equal(errors.length, 1)
})

test('正しい検証フッターを受け入れる', () => {
  assert.deepEqual(checkFooter(validLesson, 'static'), [])
})

test('検証フッターが無ければエラー', () => {
  const errors = checkFooter(validLesson.replace(/検証：.*/, ''), 'static')
  assert.equal(errors.length, 1)
})

test('日付の書式が不正ならエラー', () => {
  const broken = validLesson.replace('2026-09-08', '2026/09/08')
  const errors = checkFooter(broken, 'static')
  assert.equal(errors.length, 1)
})

test('prose モードは検証フッターを要求しない', () => {
  assert.deepEqual(checkFooter('# L00\n\n本文', 'prose'), [])
})
