import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {once} from 'node:events'
import path from 'node:path'
import {resolveSafePath, contentTypeFor, startServer} from './serve.mjs'

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

// 実際にサーバを起動して確かめる唯一のテスト。
// 上の 8 本は純粋関数しか見ていないため、「普通に開いたら動くか」を
// 誰も検証していなかった。読者は必ず末尾スラッシュを省いて入力する。
test('ディレクトリを末尾スラッシュ無しで指すとスラッシュ付きへ誘導する', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), '8thwall-serve-'))
  try {
    await mkdir(path.join(dir, 'lessons', '01-first-ar'), {recursive: true})
    await writeFile(path.join(dir, 'lessons', '01-first-ar', 'index.html'), '<h1>OK</h1>')

    // ポート 0 は OS に空きポートを選ばせる。固定ポートだと利用者の
    // 開発サーバと衝突する。
    const server = startServer(dir, 0)
    await once(server, 'listening')
    const {port} = server.address()

    try {
      const redirect = await fetch(`http://127.0.0.1:${port}/lessons/01-first-ar`, {redirect: 'manual'})
      assert.equal(redirect.status, 301)
      assert.equal(redirect.headers.get('location'), '/lessons/01-first-ar/')

      // リダイレクトを追えば実際に中身が返る
      const followed = await fetch(`http://127.0.0.1:${port}/lessons/01-first-ar`)
      assert.equal(followed.status, 200)
      assert.match(await followed.text(), /OK/)
    } finally {
      server.close()
      await once(server, 'close')
    }
  } finally {
    await rm(dir, {recursive: true, force: true})
  }
})
