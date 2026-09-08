import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validateManifest, reconcileWithDisk, publishedLessons} from './manifest.mjs'

const lesson = (over = {}) => ({
  id: '01-first-ar',
  title: '最初の AR',
  dir: 'lessons/01-first-ar',
  mode: 'static',
  status: 'published',
  ...over,
})

test('妥当な manifest はエラーを返さない', () => {
  assert.deepEqual(validateManifest({lessons: [lesson()]}), [])
})

test('lessons が配列でなければエラー', () => {
  const errors = validateManifest({lessons: 'nope'})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /lessons/)
})

test('必須フィールドの欠落を報告する', () => {
  const {title, ...withoutTitle} = lesson()
  const errors = validateManifest({lessons: [withoutTitle]})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /title/)
})

test('未知の mode を報告する', () => {
  const errors = validateManifest({lessons: [lesson({mode: 'magic'})]})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /magic/)
})

test('id の重複を報告する', () => {
  const errors = validateManifest({lessons: [lesson(), lesson()]})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /duplicate/)
})

test('dir が lessons/<id> と一致しなければエラー', () => {
  const errors = validateManifest({lessons: [lesson({dir: 'lessons/wrong'})]})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /dir/)
})

test('manifest にあるがディスクに無いレッスンを報告する', () => {
  const errors = reconcileWithDisk({lessons: [lesson()]}, [])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /01-first-ar/)
})

test('ディスクにあるが manifest に無いディレクトリを報告する', () => {
  const errors = reconcileWithDisk({lessons: []}, ['99-orphan'])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /99-orphan/)
})

test('publishedLessons は draft を除外する', () => {
  const manifest = {lessons: [lesson(), lesson({id: '02-x', dir: 'lessons/02-x', status: 'draft'})]}
  assert.deepEqual(publishedLessons(manifest).map(l => l.id), ['01-first-ar'])
})
