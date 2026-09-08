import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {lint} from './lint.mjs'

const VALID_README = `# L01 最初の AR

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
検証：2026-09-09 / Android Chrome 152.0.7977.76 / engine 1.0.0
`

const VALID_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <script src="https://cdn.jsdelivr.net/npm/@8thwall/xrextras@1.0.0/dist/xrextras.js"></script>
</head>
<body></body>
</html>
`

// 1 レッスンだけの最小ツリーを作る。overrides で 1 箇所だけ壊して、
// その壊し方が確かに検出されることを確かめる。
const buildTree = async ({readme = VALID_README, html = VALID_HTML, mode = 'static'} = {}) => {
  const root = await mkdtemp(path.join(tmpdir(), '8thwall-lint-'))
  await mkdir(path.join(root, 'lessons', '01-first-ar'), {recursive: true})
  await writeFile(path.join(root, 'lessons', 'manifest.json'), JSON.stringify({
    lessons: [{id: '01-first-ar', title: '最初の AR', dir: 'lessons/01-first-ar', mode, status: 'draft'}],
  }))
  if (readme !== null) {
    await writeFile(path.join(root, 'lessons', '01-first-ar', 'README.md'), readme)
  }
  if (html !== null) {
    await writeFile(path.join(root, 'lessons', '01-first-ar', 'index.html'), html)
  }
  return root
}

const lintTree = async (options) => {
  const root = await buildTree(options)
  try {
    return await lint(root)
  } finally {
    await rm(root, {recursive: true, force: true})
  }
}

test('完全なレッスンはエラーを出さない', async () => {
  assert.deepEqual(await lintTree(), [])
})

test('必須見出しが欠けていれば検出する', async () => {
  const errors = await lintTree({readme: VALID_README.replace('## つまずきポイント\n', '')})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /つまずきポイント/)
})

test('検証フッターが無ければ検出する', async () => {
  const errors = await lintTree({readme: VALID_README.replace(/検証：.*/, '')})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /検証フッター/)
})

test('index.html の浮動バージョンを検出する', async () => {
  const errors = await lintTree({html: VALID_HTML.replace('@1.0.0', '@1')})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /index\.html/)
})

test('README が無くても index.html の検査は続ける', async () => {
  const errors = await lintTree({readme: null, html: VALID_HTML.replace('@1.0.0', '@1')})
  // README 欠落と、浮動バージョンの両方が出る
  assert.equal(errors.length, 2)
  assert.ok(errors.some(e => /README\.md がありません/.test(e)))
  assert.ok(errors.some(e => /index\.html/.test(e) && /厳密ではありません/.test(e)))
})

test('README に載せたコードの浮動バージョンも検出する', async () => {
  const errors = await lintTree({
    readme: VALID_README + '\n```html\n<script src="https://cdn.jsdelivr.net/npm/@8thwall/xrextras@1/dist/xrextras.js"></script>\n```\n',
  })
  assert.ok(errors.some(e => /README\.md/.test(e) && /厳密ではありません/.test(e)))
})

test('README と index.html でバージョンがずれていれば検出する', async () => {
  const errors = await lintTree({
    readme: VALID_README + '\n```html\n<script src="https://cdn.jsdelivr.net/npm/@8thwall/xrextras@2.0.0/dist/xrextras.js"></script>\n```\n',
  })
  assert.ok(errors.some(e => /一致しません/.test(e)))
})

test('mode が bundled なら R1 では拒否する', async () => {
  const errors = await lintTree({mode: 'bundled'})
  assert.ok(errors.some(e => /bundled/.test(e)))
})

test('manifest にあるがディスクに無いレッスンを検出する', async () => {
  const root = await mkdtemp(path.join(tmpdir(), '8thwall-lint-'))
  try {
    await mkdir(path.join(root, 'lessons'), {recursive: true})
    await writeFile(path.join(root, 'lessons', 'manifest.json'), JSON.stringify({
      lessons: [{id: '99-missing', title: '無い', dir: 'lessons/99-missing', mode: 'static', status: 'draft'}],
    }))
    const errors = await lint(root)
    assert.ok(errors.some(e => /99-missing/.test(e)))
  } finally {
    await rm(root, {recursive: true, force: true})
  }
})
