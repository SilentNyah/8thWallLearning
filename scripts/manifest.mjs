// レッスン定義（lessons/manifest.json）の読み込みと検証。
// このファイルがレッスン一覧に関する唯一の真実を提供する。

import {readFile} from 'node:fs/promises'
import path from 'node:path'

export const MODES = ['prose', 'static', 'bundled']
export const STATUSES = ['published', 'draft']

const REQUIRED_FIELDS = ['id', 'title', 'dir', 'mode', 'status']

export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') return ['manifest がオブジェクトではありません']
  if (!Array.isArray(manifest.lessons)) return ['manifest.lessons は配列である必要があります']

  const errors = []
  const seen = new Set()

  manifest.lessons.forEach((lesson, i) => {
    const at = `lessons[${i}]`

    for (const field of REQUIRED_FIELDS) {
      if (typeof lesson[field] !== 'string' || lesson[field] === '') {
        errors.push(`${at}: ${field} は必須です`)
      }
    }
    if (lesson.mode && !MODES.includes(lesson.mode)) {
      errors.push(`${at}: 未知の mode "${lesson.mode}"（有効: ${MODES.join(', ')}）`)
    }
    if (lesson.status && !STATUSES.includes(lesson.status)) {
      errors.push(`${at}: 未知の status "${lesson.status}"（有効: ${STATUSES.join(', ')}）`)
    }
    if (lesson.id) {
      if (seen.has(lesson.id)) errors.push(`${at}: duplicate id "${lesson.id}"`)
      seen.add(lesson.id)
    }
    if (lesson.id && lesson.dir && lesson.dir !== `lessons/${lesson.id}`) {
      errors.push(`${at}: dir は "lessons/${lesson.id}" である必要があります（実際: "${lesson.dir}"）`)
    }
  })

  return errors
}

export function reconcileWithDisk(manifest, dirsOnDisk) {
  const errors = []
  const ids = new Set(manifest.lessons.map(l => l.id))

  for (const lesson of manifest.lessons) {
    if (!dirsOnDisk.includes(lesson.id)) {
      errors.push(`レッスン "${lesson.id}" は manifest にありますが、ディスク上に存在しません`)
    }
  }
  for (const dir of dirsOnDisk) {
    if (!ids.has(dir)) {
      errors.push(`ディレクトリ "lessons/${dir}" は manifest に登録されていません`)
    }
  }
  return errors
}

export function publishedLessons(manifest) {
  return manifest.lessons.filter(lesson => lesson.status === 'published')
}

export async function loadManifest(root) {
  const file = path.join(root, 'lessons', 'manifest.json')
  return JSON.parse(await readFile(file, 'utf8'))
}
