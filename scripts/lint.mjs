// コース全体の様式チェック。CI と手元の両方から実行する。
// 使い方: node scripts/lint.mjs

import {readdir, readFile, stat} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadManifest, validateManifest, reconcileWithDisk} from './manifest.mjs'
import {checkHeadings, checkFooter} from './checks/structure.mjs'
import {checkExactVersions, checkVersionConsistency, findCdnPins, findLocalLinks} from './checks/content.mjs'

const exists = async p => {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

export async function lint(root) {
  const errors = []
  const manifest = await loadManifest(root)

  errors.push(...validateManifest(manifest))
  if (errors.length > 0) return errors  // 構造が壊れている状態で先へ進んでも意味がない

  const entries = await readdir(path.join(root, 'lessons'), {withFileTypes: true})
  const dirsOnDisk = entries.filter(e => e.isDirectory()).map(e => e.name)
  errors.push(...reconcileWithDisk(manifest, dirsOnDisk))

  const filesWithPins = []

  for (const lesson of manifest.lessons) {
    const dir = path.join(root, lesson.dir)
    const readmePath = path.join(dir, 'README.md')

    if (!(await exists(readmePath))) {
      errors.push(`${lesson.id}: README.md がありません`)
      continue
    }

    const markdown = await readFile(readmePath, 'utf8')
    const label = `${lesson.id}/README.md`

    errors.push(...checkHeadings(markdown, lesson.mode).map(e => `${label}: ${e}`))
    errors.push(...checkFooter(markdown, lesson.mode).map(e => `${label}: ${e}`))

    for (const link of findLocalLinks(markdown)) {
      if (!(await exists(path.resolve(dir, link)))) {
        errors.push(`${label}: リンク切れ "${link}"`)
      }
    }

    if (lesson.mode === 'static') {
      const htmlPath = path.join(dir, 'index.html')
      if (!(await exists(htmlPath))) {
        errors.push(`${lesson.id}: mode が static ですが index.html がありません`)
        continue
      }
      const html = await readFile(htmlPath, 'utf8')
      const htmlLabel = `${lesson.id}/index.html`
      errors.push(...checkExactVersions(html).map(e => `${htmlLabel}: ${e}`))
      filesWithPins.push({file: htmlLabel, pins: findCdnPins(html)})
    }
  }

  errors.push(...checkVersionConsistency(filesWithPins))
  return errors
}

// CLI として実行されたときだけ動かす（テストから import しても実行されない）
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(fileURLToPath(import.meta.url), '..', '..')
  const errors = await lint(root)
  if (errors.length > 0) {
    for (const error of errors) console.error(`✗ ${error}`)
    console.error(`\n${errors.length} 件の問題が見つかりました`)
    process.exit(1)
  }
  console.log('✓ lint: 問題なし')
}
