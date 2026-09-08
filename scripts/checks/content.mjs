// 本文とマークアップの内容チェック。
// 「バージョンを厳密固定する」という方針を、人間の記憶ではなく機械に守らせる。

const EXACT_SEMVER = /^\d+\.\d+\.\d+$/
// 外部スキームとページ内アンカーを除いたマークダウンリンク。
// 先頭の / も除外する（//example.com のプロトコル相対リンクと
// /lessons/x のサイト絶対リンクは、どちらもローカルパスではない）。
const LOCAL_LINK_RE = /\[[^\]]*\]\((?!https?:|mailto:|#|\/)([^)#\s]+)(?:#[^)\s]*)?\)/g

// 外部アセットは <script src> と <link href> だけを対象にする。
// 本文中の <a href> まで拾うと、ただのリンクを CDN 違反と誤検出する。
const ASSET_URL_RE = /<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi

// 使ってよい CDN は 1 つだけにする。ホストが増えるほど、
// バージョン固定のルールを守らせる面が広がって破綻する。
const ALLOWED_CDN_HOST = 'cdn.jsdelivr.net'

// jsdelivr の npm パス: /npm/<pkg>[@<version>][/<file>]
// pkg はスコープ付き（@scope/name）とスコープ無しの両方がある。
const JSDELIVR_NPM_RE = /^\/npm\/((?:@[^@/]+\/)?[^@/]+)(?:@([^/]+))?(?:\/|$)/

const externalAssetUrls = html => [...html.matchAll(ASSET_URL_RE)]
  .map(m => m[1])
  .filter(url => /^https?:\/\//i.test(url))

// URL を 1 本ずつ調べて、ピンとエラーを返す。
// 「抽出」と「妥当性判定」は別の関心事なので、両方返しうる形にする。
// 例えば @1 は厳密ではないためエラーになるが、ピンとしては存在する。
const inspect = url => {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return {error: `URL を解釈できません: "${url}"`}
  }
  if (parsed.host !== ALLOWED_CDN_HOST) {
    return {error: `許可されていない CDN ホストです: "${parsed.host}"（使用できるのは ${ALLOWED_CDN_HOST} のみ）`}
  }
  if (parsed.protocol !== 'https:') {
    return {error: `https ではありません: "${url}"`}
  }
  const matched = JSDELIVR_NPM_RE.exec(parsed.pathname)
  if (!matched) {
    return {error: `jsdelivr の npm パスではありません: "${parsed.pathname}"`}
  }
  const [, pkg, version] = matched
  if (version === undefined) {
    return {error: `${pkg} にバージョンが指定されていません（省略すると最新版に解決され、説明と挙動がずれる）`}
  }
  const pin = {pkg, version}
  if (!EXACT_SEMVER.test(version)) {
    return {pin, error: `${pkg} のバージョン指定 "${version}" が厳密ではありません（例: 1.2.3）`}
  }
  return {pin}
}

export function findCdnPins(html) {
  return externalAssetUrls(html).map(inspect).filter(r => r.pin).map(r => r.pin)
}

export function checkExactVersions(html) {
  return externalAssetUrls(html).map(inspect).filter(r => r.error).map(r => r.error)
}

export function checkVersionConsistency(filesWithPins) {
  const byPackage = new Map()

  for (const {file, pins} of filesWithPins) {
    for (const pin of pins) {
      if (!byPackage.has(pin.pkg)) byPackage.set(pin.pkg, new Map())
      const versions = byPackage.get(pin.pkg)
      if (!versions.has(pin.version)) versions.set(pin.version, [])
      versions.get(pin.version).push(file)
    }
  }

  const errors = []
  for (const [pkg, versions] of byPackage) {
    if (versions.size > 1) {
      const detail = [...versions].map(([v, files]) => `${v} (${files.join(', ')})`).join(' / ')
      errors.push(`${pkg} のバージョンがレッスン間で一致しません: ${detail}`)
    }
  }
  return errors
}

export function findLocalLinks(markdown) {
  return [...markdown.matchAll(LOCAL_LINK_RE)].map(m => m[1])
}
