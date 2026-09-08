// dist/ を生成する。R1 のレッスンは全てビルドレスであるためコピーと索引生成のみ。
// R2 で bundled レッスンが増えたら、ここから webpack を呼び出す形に拡張する。

import {cp, mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadManifest, validateManifest, publishedLessons} from './manifest.mjs'

const escapeHtml = text => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const linkFor = lesson =>
  lesson.mode === 'prose' ? `./${lesson.dir}/README.md` : `./${lesson.dir}/`

export function renderIndex(lessons) {
  const items = lessons.map(lesson => `      <li>
        <a href="${escapeHtml(linkFor(lesson))}">${escapeHtml(lesson.id)}　${escapeHtml(lesson.title)}</a>
      </li>`).join('\n')

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>8th Wall で作る WebAR 入門</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.8; }
    li { margin: 0.4rem 0; }
  </style>
</head>
<body>
  <h1>8th Wall で作る WebAR 入門</h1>
  <p>Android Chrome と PC で検証しています。iOS は未検証です。</p>
  <nav>
    <ul>
${items}
    </ul>
  </nav>
</body>
</html>
`
}

export async function build(root, outDir) {
  const manifest = await loadManifest(root)

  // ビルドは lesson.dir を cp の宛先にする。検証せずに使うと、
  // 手で壊した manifest が予期しない場所へ書き込む。
  const problems = validateManifest(manifest)
  if (problems.length > 0) {
    throw new Error(`manifest が不正です:\n${problems.map(p => `  ${p}`).join('\n')}`)
  }

  const lessons = publishedLessons(manifest)

  await rm(outDir, {recursive: true, force: true})
  await mkdir(outDir, {recursive: true})

  for (const lesson of lessons) {
    await cp(path.join(root, lesson.dir), path.join(outDir, lesson.dir), {recursive: true})
  }

  // レッスンは 8frame を ../../external/scripts/ から読み込むため、external/ も dist へ写す。
  // これが無いと dist 配信時に全レッスンでスクリプトが 404 になる。
  await cp(path.join(root, 'external'), path.join(outDir, 'external'), {recursive: true})

  const sharedDir = path.join(root, 'shared')
  try {
    await cp(sharedDir, path.join(outDir, 'shared'), {recursive: true, force: true})
  } catch (error) {
    // shared/ がまだ無い段階は正常。それ以外の失敗（権限、容量など）は握り潰さない。
    // 握り潰すと、不完全な dist を出したまま「成功」と表示してしまう。
    if (error.code !== 'ENOENT') throw error
  }

  await writeFile(path.join(outDir, 'index.html'), renderIndex(lessons), 'utf8')
  console.log(`✓ build: ${lessons.length} 件のレッスンを ${outDir} に出力しました`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(fileURLToPath(import.meta.url), '..', '..')
  await build(root, path.join(root, 'dist'))
}
