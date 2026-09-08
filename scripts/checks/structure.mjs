// レッスン README の様式チェック。
// 拾い読みする読者に毎回書式を学び直させないため、見出し構成を機械的に強制する。

export const LESSON_HEADINGS = [
  'このレッスンでできるようになること',
  '前提',
  'まず動かす',
  '解説',
  'つまずきポイント',
]

// 例: 検証：2026-09-08 / Android Chrome 140 / engine 1.2.3
export const FOOTER_RE = /^検証：(\d{4}-\d{2}-\d{2}) \/ (.+) \/ engine (.+)$/m

// 見出しを正規表現へ埋め込む前にメタ文字を無効化する。
// これが無いと「設定(オプション)」のような見出しを足した瞬間に
// 正規表現の構文エラーで checkHeadings 自体が落ちる。
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function checkHeadings(markdown, mode) {
  if (mode === 'prose') {
    return /^# .+/m.test(markdown) ? [] : ['H1 見出しがありません']
  }

  const errors = []
  for (const heading of LESSON_HEADINGS) {
    // 見出し行そのものに一致させる（本文中の同じ語に反応させない）
    if (!new RegExp(`^## ${escapeRegExp(heading)}\\s*$`, 'm').test(markdown)) {
      errors.push(`必須見出し "## ${heading}" がありません`)
    }
  }
  return errors
}

export function checkFooter(markdown, mode) {
  if (mode === 'prose') return []

  return FOOTER_RE.test(markdown)
    ? []
    : ['検証フッターがないか書式が不正です（例: 検証：2026-09-08 / Android Chrome 140 / engine 1.2.3）']
}
