import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {renderIndex, build} from './build.mjs'

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

// build() 本体の結合テスト。
// レッスンをコピーするループは公開サイトを組み立てる中核だが、
// 実際の manifest は全レッスンが draft のため手元検証では一度も通らない。
// 一時ディレクトリに最小構成を作って、ここで実際に走らせる。
test('build は published レッスンだけを dist へ写す', async () => {
  const root = await mkdtemp(path.join(tmpdir(), '8thwall-build-'))
  try {
    await mkdir(path.join(root, 'lessons', '01-first-ar'), {recursive: true})
    await writeFile(path.join(root, 'lessons', '01-first-ar', 'index.html'), 'LESSON ONE')
    await mkdir(path.join(root, 'lessons', '02-coordinates'), {recursive: true})
    await writeFile(path.join(root, 'lessons', '02-coordinates', 'index.html'), 'LESSON TWO')
    await mkdir(path.join(root, 'external', 'scripts'), {recursive: true})
    await writeFile(path.join(root, 'external', 'scripts', '8frame.js'), 'AFRAME')
    await writeFile(path.join(root, 'lessons', 'manifest.json'), JSON.stringify({
      lessons: [
        {id: '01-first-ar', title: '最初の AR', dir: 'lessons/01-first-ar', mode: 'static', status: 'published'},
        {id: '02-coordinates', title: '座標系', dir: 'lessons/02-coordinates', mode: 'static', status: 'draft'},
      ],
    }))

    const out = path.join(root, 'dist')
    await build(root, out)

    // published は写る
    assert.equal(await readFile(path.join(out, 'lessons', '01-first-ar', 'index.html'), 'utf8'), 'LESSON ONE')
    // draft は写らない
    await assert.rejects(readFile(path.join(out, 'lessons', '02-coordinates', 'index.html')))
    // external は写る（これが無いと全レッスンでスクリプトが 404 になる）
    assert.equal(await readFile(path.join(out, 'external', 'scripts', '8frame.js'), 'utf8'), 'AFRAME')
    // 索引には published だけが並ぶ
    const index = await readFile(path.join(out, 'index.html'), 'utf8')
    assert.match(index, /01-first-ar/)
    assert.doesNotMatch(index, /02-coordinates/)
  } finally {
    await rm(root, {recursive: true, force: true})
  }
})
