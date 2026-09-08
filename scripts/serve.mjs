// 手元確認用の静的サーバ。新規依存を増やさないため node:http だけで書く。
// 使い方: node scripts/serve.mjs [port]

import http from 'node:http'
import {createReadStream} from 'node:fs'
import {stat} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {build} from './build.mjs'

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
}

export function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

export function resolveSafePath(root, urlPath) {
  let pathname
  try {
    // クエリとエンコードを剥がす。不正なエンコードはここで例外になる。
    pathname = decodeURIComponent(urlPath.split('?')[0])
  } catch {
    return null
  }

  if (pathname.endsWith('/')) pathname += 'index.html'

  const resolved = path.resolve(root, '.' + pathname)
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep

  // root の外を指していたら拒否する
  return resolved === root || resolved.startsWith(rootWithSep) ? resolved : null
}

export function startServer(root, port) {
  const server = http.createServer(async (req, res) => {
    const filePath = resolveSafePath(root, req.url)
    if (filePath === null) {
      res.writeHead(403, {'content-type': 'text/plain; charset=utf-8'})
      res.end('403 Forbidden')
      return
    }
    try {
      const info = await stat(filePath)
      if (info.isDirectory()) {
        // 末尾スラッシュ無しでディレクトリを指された場合は、スラッシュ付きへ誘導する。
        // ここで 404 を返すと、読者が /lessons/01-first-ar と打った瞬間に詰まる。
        // ページ内の相対パスもスラッシュの有無で解決先が変わるため、リダイレクトが正しい。
        const [pathname, query = ''] = req.url.split('?')
        res.writeHead(301, {location: pathname + '/' + (query && '?' + query)})
        res.end()
        return
      }
      res.writeHead(200, {'content-type': contentTypeFor(filePath)})
      createReadStream(filePath).pipe(res)
    } catch {
      res.writeHead(404, {'content-type': 'text/plain; charset=utf-8'})
      res.end('404 Not Found')
    }
  })
  return server.listen(port)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(fileURLToPath(import.meta.url), '..', '..')
  const dist = path.join(root, 'dist')
  const port = Number(process.argv[2] ?? 8080)

  await build(root, dist)
  startServer(dist, port)
  console.log(`http://localhost:${port} で配信中（Ctrl+C で停止）`)
}
