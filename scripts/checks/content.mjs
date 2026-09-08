// 本文とマークアップの内容チェック。
// 「バージョンを厳密固定する」という方針を、人間の記憶ではなく機械に守らせる。

// バージョンの後ろにパスが続かない URL（例: .../xrextras@1）も拾う必要がある。
// 末尾の / を必須にすると、同じ浮動バージョンがパスの有無だけで
// 検出されたりされなかったりする穴が空く。
const CDN_RE = /https:\/\/cdn\.jsdelivr\.net\/npm\/(@[^@/]+\/[^@/]+|[^@/]+)@([^/"'\s>]+)/g
const EXACT_SEMVER = /^\d+\.\d+\.\d+$/
// 外部スキームとページ内アンカーを除いたマークダウンリンク。
// 先頭の / も除外する（//example.com のプロトコル相対リンクと
// /lessons/x のサイト絶対リンクは、どちらもローカルパスではない）。
const LOCAL_LINK_RE = /\[[^\]]*\]\((?!https?:|mailto:|#|\/)([^)#\s]+)(?:#[^)\s]*)?\)/g

export function findCdnPins(html) {
  return [...html.matchAll(CDN_RE)].map(m => ({pkg: m[1], version: m[2]}))
}

export function checkExactVersions(html) {
  return findCdnPins(html)
    .filter(pin => !EXACT_SEMVER.test(pin.version))
    .map(pin => `${pin.pkg} のバージョン指定 "${pin.version}" が厳密ではありません（例: 1.2.3）`)
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
