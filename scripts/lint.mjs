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
    const htmlPath = path.join(dir, 'index.html')

    // R1 のビルドは bundled を扱えない。linkFor が static と同じ扱いをするため、
    // 気づかないまま壊れた dist が出る。R2 で実装するまでは明示的に拒否する。
    if (lesson.mode === 'bundled') {
      errors.push(`${lesson.id}: mode "bundled" は R1 では未対応です`)
    }

    if (await exists(readmePath)) {
      const markdown = await readFile(readmePath, 'utf8')
      const label = `${lesson.id}/README.md`

      errors.push(...checkHeadings(markdown, lesson.mode).map(e => `${label}: ${e}`))
      errors.push(...checkFooter(markdown, lesson.mode).map(e => `${label}: ${e}`))

      for (const link of findLocalLinks(markdown)) {
        if (!(await exists(path.resolve(dir, link)))) {
          errors.push(`${label}: リンク切れ "${link}"`)
        }
      }

      // README に載せたコードも検査する。読者が実際にコピーするのはこちらであり、
      // ここが緩いと index.html だけ正しくても意味がない。
      errors.push(...checkExactVersions(markdown).map(e => `${label}: ${e}`))
      filesWithPins.push({file: label, pins: findCdnPins(markdown)})
    } else {
      // README が無くても HTML の検査は続ける。
      // ここで continue すると、書きかけのレッスンが完全な無検査になる。
      errors.push(`${lesson.id}: README.md がありません`)
    }

    if (lesson.mode !== 'prose') {
      if (await exists(htmlPath)) {
        const html = await readFile(htmlPath, 'utf8')
        const label = `${lesson.id}/index.html`
        errors.push(...checkExactVersions(html).map(e => `${label}: ${e}`))
        filesWithPins.push({file: label, pins: findCdnPins(html)})
      } else {
        errors.push(`${lesson.id}: mode が ${lesson.mode} ですが index.html がありません`)
      }
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
