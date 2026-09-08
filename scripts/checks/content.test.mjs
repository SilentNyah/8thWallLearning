import {test} from 'node:test'
import assert from 'node:assert/strict'
import {findCdnPins, checkExactVersions, checkVersionConsistency, findLocalLinks} from './content.mjs'

const html = ver => `<script src="https://cdn.jsdelivr.net/npm/@8thwall/xrextras@${ver}/dist/xrextras.js"></script>`

test('CDN の パッケージ名とバージョンを抽出する', () => {
  assert.deepEqual(findCdnPins(html('1.2.3')), [{pkg: '@8thwall/xrextras', version: '1.2.3'}])
})

test('スコープなしパッケージも抽出する', () => {
  const tag = '<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>'
  assert.deepEqual(findCdnPins(tag), [{pkg: 'three', version: '0.160.0'}])
})

test('厳密な semver はエラーにしない', () => {
  assert.deepEqual(checkExactVersions(html('1.2.3')), [])
})

test('メジャー範囲指定をエラーにする', () => {
  const errors = checkExactVersions(html('1'))
  assert.equal(errors.length, 1)
  assert.match(errors[0], /@8thwall\/xrextras/)
})

test('キャレット指定をエラーにする', () => {
  assert.equal(checkExactVersions(html('^1.2.3')).length, 1)
})

test('latest をエラーにする', () => {
  assert.equal(checkExactVersions(html('latest')).length, 1)
})

test('全ファイルでバージョンが一致していればエラーなし', () => {
  const input = [
    {file: 'a.html', pins: [{pkg: 'x', version: '1.0.0'}]},
    {file: 'b.html', pins: [{pkg: 'x', version: '1.0.0'}]},
  ]
  assert.deepEqual(checkVersionConsistency(input), [])
})

test('レッスン間でバージョンがずれていれば報告する', () => {
  const input = [
    {file: 'a.html', pins: [{pkg: 'x', version: '1.0.0'}]},
    {file: 'b.html', pins: [{pkg: 'x', version: '2.0.0'}]},
  ]
  const errors = checkVersionConsistency(input)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /a\.html/)
  assert.match(errors[0], /b\.html/)
})

test('相対リンクを抽出する', () => {
  assert.deepEqual(findLocalLinks('[次へ](../02-coordinates/README.md)'), ['../02-coordinates/README.md'])
})

test('外部リンクとアンカーは抽出しない', () => {
  const md = '[外部](https://example.com) [節](#section) [メール](mailto:a@b.c)'
  assert.deepEqual(findLocalLinks(md), [])
})

test('相対リンクのアンカー部分を取り除く', () => {
  assert.deepEqual(findLocalLinks('[節へ](./README.md#解説)'), ['./README.md'])
})

// バージョンの後ろにパスが続かない URL は jsdelivr の正当な短縮形であり、
// ここを取りこぼすと「浮動バージョン禁止」の保証に穴が空く
const bareTag = '<script src="https://cdn.jsdelivr.net/npm/@8thwall/xrextras@1"></script>'

test('パス無しの CDN URL からもバージョンを抽出する', () => {
  assert.deepEqual(findCdnPins(bareTag), [{pkg: '@8thwall/xrextras', version: '1'}])
})

test('パス無しの浮動バージョンもエラーにする', () => {
  assert.equal(checkExactVersions(bareTag).length, 1)
})

test('プロトコル相対リンクはローカルリンクとして扱わない', () => {
  assert.deepEqual(findLocalLinks('[a](//example.com/script.js)'), [])
})

test('サイト絶対リンクはローカルリンクとして扱わない', () => {
  assert.deepEqual(findLocalLinks('[b](/lessons/00-about/README.md)'), [])
})

// レビューで実証された素通りパターン。5 種類の違反を仕込んだツリーで
// lint がエラー 0 件を返したため、1 つずつ固定する。
const tag = url => `<script src="${url}"></script>`

test('バージョンを省略した jsdelivr URL をエラーにする', () => {
  const errors = checkExactVersions(tag('https://cdn.jsdelivr.net/npm/@8thwall/xrextras/dist/xrextras.js'))
  assert.equal(errors.length, 1)
  assert.match(errors[0], /バージョンが指定されていません/)
})

test('jsdelivr 以外の CDN をエラーにする', () => {
  const errors = checkExactVersions(tag('https://unpkg.com/@8thwall/xrextras@1.0.0/dist/xrextras.js'))
  assert.equal(errors.length, 1)
  assert.match(errors[0], /unpkg\.com/)
})

test('jsdelivr の gh パスをエラーにする', () => {
  const errors = checkExactVersions(tag('https://cdn.jsdelivr.net/gh/aframevr/aframe@master/dist/aframe.js'))
  assert.equal(errors.length, 1)
})

test('http の CDN URL をエラーにする', () => {
  const errors = checkExactVersions(tag('http://cdn.jsdelivr.net/npm/@8thwall/xrextras@1.0.0/dist/xrextras.js'))
  assert.equal(errors.length, 1)
  assert.match(errors[0], /https/)
})

test('本文中の a href は CDN 検査の対象にしない', () => {
  assert.deepEqual(checkExactVersions('<a href="https://example.com/docs">説明</a>'), [])
})

test('ローカルの script src は CDN 検査の対象にしない', () => {
  assert.deepEqual(checkExactVersions(tag('../../external/scripts/8frame-1.5.0.min.js')), [])
})
