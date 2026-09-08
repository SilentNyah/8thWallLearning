# 8th Wall 日本語学習コース R1 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8th Wall 日本語学習コースの R1（L00–L04）を、ビルド基盤・lint・CI とともに公開可能な状態まで作り切る。

**Architecture:** レッスンは `lessons/<id>/` に置き、`lessons/manifest.json` を単一の真実として lint・ビルド・索引ページを駆動する。R1 のレッスンは全てビルドレス（素の HTML + CDN）であるため、R1 ではバンドラを導入せず、Node 標準機能のみのスクリプト群で `dist/` を生成する。テストは `node:test` を使い、外部テストフレームワークを追加しない。

**Tech Stack:** Node.js 20+（`node:test`、`node:fs`、`node:http`）、A-Frame（8frame）、8th Wall XR Engine（jsdelivr 配信の固定バージョン）、GitHub Actions、GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-09-08-8thwall-course-design.md`

## Global Constraints

- 本文は**日本語のみ**。コード内コメントも日本語、識別子は英語。
- コース本文は **CC BY 4.0**、サンプルコードは **MIT**（既存 `LICENSE` の 8th Wall, Inc. / Niantic Spatial, Inc. 表記を保持）。
- **`8thwall.com` および `8th.io` への依存をゼロにする。** これらのドメインへのリンクを一切書かない。
- CDN の URL は**厳密な semver 指定のみ**（`@1` のような範囲指定は lint でエラーにする）。
- 同一パッケージのバージョンは**全レッスンで一致**していること。
- **ライセンスを出典付きで明示できないアセットはリポジトリに置かない。** `cactus.glb` は出典（Sketchfab）が削除済みのため使用禁止。
- 実機保証は **Android Chrome と PC のみ**。iOS は未検証である旨を明記し、動作を保証しない。
- レッスン README は固定様式に従う（必須見出し 5 つ + 検証フッター）。
- 検証フッターの日付は、**Android 実機で動作を確認したときにのみ**更新する。
- Node.js **20 以上**を要求する（`node --test` を使うため）。
- 新規の npm 依存を追加しない。R1 のスクリプトは Node 標準モジュールのみで書く。

## 設計からの逸脱（実装計画で修正した点）

1. **復元点は既に存在するため、新たに作成しない。** 設計 第12節は「コミットが 1 つも無い」ことを前提に、素のサンプルを 1 コミットして復元点を作るとしていたが、**この前提は事実ではなかった**。計画作成時点で `0d87a0c "first commit"`（2026-09-08 01:21、SilentNyah 作）が既に存在し、`origin/main`（`https://github.com/SilentNyah/8thWallLearning.git`、public）へ push 済みである。このコミットが素のサンプル全体を含んでおり、設計が求めた復元点そのものとして機能する。

   **付随する決定:** `src/assets/cactus.glb` は `0d87a0c` に含まれるため、**既に公開履歴に載っている**。履歴の書き換えは行わない（利用者判断で確定済み）。理由は、同じファイルを 8th Wall 自身が MIT ライセンスの公開サンプルリポジトリで配布しており当方が露出源ではないこと、push 済みリポジトリを書き換えても GitHub 側の到達不能オブジェクトと LFS ストレージからの完全削除は保証されないこと、force-push が既存クローンを壊す破壊的操作であることの 3 点による。**作業ツリーからは除外し、以降のレッスンで一切使用しない。**
2. **webpack のマルチエントリ化を R2 へ繰り延べる。** 設計 第12節はステップ 5 に置いていたが、R1 のレッスンは全て `mode: static` であり、bundled レッスンがゼロの状態でマルチエントリ機構を作っても検証できない。R1 は `scripts/build.mjs` による静的ビルドのみとし、R2 で同じ `manifest.json` を webpack から読ませる形に拡張する。**作ったものは捨てない。**
3. **Task 5 の `build()` は `external/` も `dist/` へコピーする（実行前スキャンで発見した欠陥の修正）。** 当初の Task 5 は公開レッスンと `shared/` しかコピーしていなかったが、全レッスンは 8frame を `../../external/scripts/8frame-1.5.0.min.js` から読み込むため、`dist` 配信時に**全レッスンでスクリプトが 404 になる**。Step 3 のコードに `external/` のコピーを追加し、Step 5 の検証項目にも `dist/external/scripts/8frame-1.5.0.min.js` の存在確認を加えた。

4. **Task 3 の `checkHeadings` は見出しを正規表現へ埋め込む前にエスケープする（レビューで発見した欠陥の修正）。** 元のコードは `LESSON_HEADINGS` を無加工で `new RegExp` に渡していたため、`設定(オプション)` のようにメタ文字を含む見出しを追加した瞬間に `Invalid regular expression` で関数自体がクラッシュする。リンタが自分の設定で落ちるのは誤判定より悪い失敗であり、修正は 1 行で済むため潰した。

5. **Task 4 の `CDN_RE` と `LOCAL_LINK_RE` を修正（レビューで実証された欠陥）。** `CDN_RE` はバージョンの直後に `/` を要求していたため、`https://cdn.jsdelivr.net/npm/@8thwall/xrextras@1` のようにパスが続かない URL を**完全に見逃していた**。同一の浮動バージョンが末尾パスの有無だけで検出されたりされなかったりする状態は、本コース唯一の品質保証機構に空いた穴であるため、末尾 `/` の要求を外した。`LOCAL_LINK_RE` は `//example.com`（プロトコル相対）と `/lessons/x`（サイト絶対）をローカルパスとして拾い、実在しない「リンク切れ」を誤報していたため、否定先読みに `/` を追加した。いずれも対応するテストを追加している。

6. **`npm test` のコマンドを引数なしの `node --test` に変更（レビューで発見した欠陥と、その修正時に判明した二次的欠陥）。** 当初の `node --test scripts/` は **Node v22 でディレクトリを走査せず**失敗する。Task 7 の CI が実行するのはこのコマンドであり、放置すれば CI が恒久的に赤になっていた。

   一度はグロブ形式 `node --test "scripts/**/*.test.mjs"` を採ったが、**これも誤りだった**。Node はテストランナーの引数解釈をメジャーバージョン間で変えており、v22 は引数を glob として扱う一方、**v20 は glob を展開しない**。CI は Node 20 で走るため、グロブ形式では今度は CI 側だけが壊れる。引数なしの `node --test` だけが v18 / v20 / v22 で同じ意味を持つ。プラン内の実行手順もすべて `npm test` に統一し、実際のコマンドは `package.json` の 1 箇所だけが持つ形にした。

7. **QR コード生成を R5 へ繰り延べる。** 設計 第10節の「QR をビルド時に生成」は公開導線（L13）の要件であり、R1 の読者は Chrome のポートフォワーディング経由で `localhost` を開くため QR を必要としない。R1 では `8th.io` を使わないことで制約は満たされる。

---

### Task 1: リポジトリ衛生の修正と LFS 追跡パスの更新

**Files:**
- Modify: `.gitattributes`
- Modify: `package.json`
- Delete: `dev/null/`（Git LFS フックの複製。正規のフックは `.git/hooks/` に存在することを確認済み）
- Delete: `src/assets/cactus.glb`、`src/assets/preview.gif`、`src/assets/sand.jpg`（作業ツリーから。**履歴からは削除しない**）

**Interfaces:**
- Consumes: 既存コミット `0d87a0c`（素のサンプル全体を含む復元点。push 済み）
- Produces: 以降の全タスクの基点となるクリーンな作業ツリー

- [ ] **Step 1: Node のバージョンを確認する**

Run: `node --version`
Expected: `v20.0.0` 以上。下回る場合はここで停止し、Node を更新してから再開する（`node --test` が必要）。

- [ ] **Step 2: 復元点が存在することを確認する**

Run:
```bash
git show --stat --oneline 0d87a0c | grep -E "cactus\.glb|app\.js|tap-place\.js"
```
Expected: 3 件とも出力される。`0d87a0c` が素のサンプルを含む復元点であり、**これ以上の退避は不要である**。出力されない場合はここで停止し、削除に進んではならない。

- [ ] **Step 3: `.gitattributes` を新構成へ書き換える**

`.gitattributes` の内容を次の通りに置き換える。

```
* text=auto

*.png filter=lfs diff=lfs merge=lfs -text
*.jpg filter=lfs diff=lfs merge=lfs -text
*.jpeg filter=lfs diff=lfs merge=lfs -text
*.glb filter=lfs diff=lfs merge=lfs -text
shared/assets/** filter=lfs diff=lfs merge=lfs -text
lessons/*/assets/** filter=lfs diff=lfs merge=lfs -text
external/** filter=lfs diff=lfs merge=lfs -text
```

旧設定で LFS 追跡されていたファイル（`src/assets/**`）は Step 4 で全て削除するため、`git add --renormalize` による再正規化は不要である。削除後に LFS 追跡が残るのは `external/scripts/8frame-1.5.0.min.js` のみで、これは `external/**` パターンが新旧どちらにも存在するため影響を受けない。

- [ ] **Step 4: ゴミと検証不能アセットを削除する**

これらは `0d87a0c` で追跡済みのため、`git rm` を使う（作業ツリーからのみ消す `Remove-Item` では追跡が残る）。

```bash
git rm -r --quiet dev
git rm --quiet src/assets/cactus.glb src/assets/preview.gif src/assets/sand.jpg
git status --short
```
Expected: 4 パスが `D`（削除）として並ぶこと。`src/` には `app.js`、`index.css`、`index.html`、`tap-place.js` の 4 件が残る。

`dev/null/` は Git LFS フックの複製であり、正規のフックが `.git/hooks/` に存在することを確認済みである。アセット 3 件は出典ライセンスを検証できないため今後使用しない（`cactus.glb` の Sketchfab 出典は削除済み）。**履歴からの除去は行わない**（冒頭の「設計からの逸脱」1 を参照）。

- [ ] **Step 5: `package.json` に Node 要件を追加する**

`package.json` の `"private": true,` の直後に次を挿入する。

```json
  "engines": {
    "node": ">=20"
  },
```

- [ ] **Step 6: 追跡中のバイナリが残っていないことを確認する**

Run:
```bash
git add -A && git ls-files | grep -E '\.(glb|jpg|jpeg|png|gif)$' ; echo "exit=$?"
```
Expected: **何も出力されず** `exit=1` になること。1 件でも出力された場合は Step 4 をやり直す。

Run:
```bash
git lfs ls-files
```
Expected: `external/scripts/8frame-1.5.0.min.js` の 1 件のみ。

- [ ] **Step 7: Commit**

```bash
git commit -m "chore: リポジトリ衛生の修正と LFS 追跡パスの更新

- .gitattributes の LFS 追跡パスを lessons/ shared/ 構成へ変更
- dev/null/ を削除（Git LFS フックの複製。正規のフックは .git/hooks/ にある）
- 出典ライセンスを検証できないアセット 3 件を作業ツリーから除外
  （cactus.glb の Sketchfab 出典は削除済みで確認不能。
   履歴からの除去は行わない — 判断の根拠は実装計画に記載）
- Node 20 以上を要求

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: manifest モジュール

**Files:**
- Create: `lessons/manifest.json`
- Create: `scripts/manifest.mjs`
- Test: `scripts/manifest.test.mjs`

**Interfaces:**
- Consumes: なし
- Produces:
  - `MODES: string[]` — `['prose', 'static', 'bundled']`
  - `STATUSES: string[]` — `['published', 'draft']`
  - `validateManifest(manifest): string[]` — エラーメッセージ配列（空なら妥当）
  - `reconcileWithDisk(manifest, dirsOnDisk: string[]): string[]`
  - `publishedLessons(manifest): Lesson[]`
  - `loadManifest(root): Promise<Manifest>`
  - `Lesson` は `{id, title, dir, mode, status}` の 5 フィールドを持つオブジェクト

- [ ] **Step 1: Write the failing test**

Create `scripts/manifest.test.mjs`:

```js
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validateManifest, reconcileWithDisk, publishedLessons} from './manifest.mjs'

const lesson = (over = {}) => ({
  id: '01-first-ar',
  title: '最初の AR',
  dir: 'lessons/01-first-ar',
  mode: 'static',
  status: 'published',
  ...over,
})

test('妥当な manifest はエラーを返さない', () => {
  assert.deepEqual(validateManifest({lessons: [lesson()]}), [])
})

test('lessons が配列でなければエラー', () => {
  const errors = validateManifest({lessons: 'nope'})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /lessons/)
})

test('必須フィールドの欠落を報告する', () => {
  const {title, ...withoutTitle} = lesson()
  const errors = validateManifest({lessons: [withoutTitle]})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /title/)
})

test('未知の mode を報告する', () => {
  const errors = validateManifest({lessons: [lesson({mode: 'magic'})]})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /magic/)
})

test('id の重複を報告する', () => {
  const errors = validateManifest({lessons: [lesson(), lesson()]})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /duplicate/)
})

test('dir が lessons/<id> と一致しなければエラー', () => {
  const errors = validateManifest({lessons: [lesson({dir: 'lessons/wrong'})]})
  assert.equal(errors.length, 1)
  assert.match(errors[0], /dir/)
})

test('manifest にあるがディスクに無いレッスンを報告する', () => {
  const errors = reconcileWithDisk({lessons: [lesson()]}, [])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /01-first-ar/)
})

test('ディスクにあるが manifest に無いディレクトリを報告する', () => {
  const errors = reconcileWithDisk({lessons: []}, ['99-orphan'])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /99-orphan/)
})

test('publishedLessons は draft を除外する', () => {
  const manifest = {lessons: [lesson(), lesson({id: '02-x', dir: 'lessons/02-x', status: 'draft'})]}
  assert.deepEqual(publishedLessons(manifest).map(l => l.id), ['01-first-ar'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module` で `./manifest.mjs` が見つからない。

- [ ] **Step 3: Write minimal implementation**

Create `scripts/manifest.mjs`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 9 tests pass。

- [ ] **Step 5: manifest.json を作成する**

Create `lessons/manifest.json`:

```json
{
  "lessons": [
    {
      "id": "00-about",
      "title": "このコースについて",
      "dir": "lessons/00-about",
      "mode": "prose",
      "status": "draft"
    },
    {
      "id": "01-first-ar",
      "title": "最初の AR",
      "dir": "lessons/01-first-ar",
      "mode": "static",
      "status": "draft"
    },
    {
      "id": "02-coordinates",
      "title": "座標系とスケール",
      "dir": "lessons/02-coordinates",
      "mode": "static",
      "status": "draft"
    },
    {
      "id": "03-materials-lights",
      "title": "マテリアルとライト",
      "dir": "lessons/03-materials-lights",
      "mode": "static",
      "status": "draft"
    },
    {
      "id": "04-ecs-components",
      "title": "ECS と独自コンポーネント",
      "dir": "lessons/04-ecs-components",
      "mode": "static",
      "status": "draft"
    }
  ]
}
```

全レッスンを `draft` で開始する。`published` へ切り替えるのは、Task 14 で Android 実機検証を通過した時点である。

- [ ] **Step 6: Commit**

```bash
git add scripts/manifest.mjs scripts/manifest.test.mjs lessons/manifest.json
git commit -m "feat: レッスン定義を manifest.json に集約するモジュールを追加

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 構造チェック（必須見出しと検証フッター）

**Files:**
- Create: `scripts/checks/structure.mjs`
- Test: `scripts/checks/structure.test.mjs`

**Interfaces:**
- Consumes: Task 2 の `MODES`（`'prose' | 'static' | 'bundled'`）
- Produces:
  - `LESSON_HEADINGS: string[]` — 必須見出しの本文（`## ` を除く）
  - `FOOTER_RE: RegExp` — 検証フッターの書式
  - `checkHeadings(markdown, mode): string[]`
  - `checkFooter(markdown, mode): string[]`

- [ ] **Step 1: Write the failing test**

Create `scripts/checks/structure.test.mjs`:

```js
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {checkHeadings, checkFooter, LESSON_HEADINGS} from './structure.mjs'

const validLesson = `# L01 最初の AR

## このレッスンでできるようになること
- カメラを起動できる

## 前提
なし

## まず動かす
手順

## 解説
本文

## つまずきポイント
症状 → 原因 → 対処

---
検証：2026-09-08 / Android Chrome 140 / engine 1.2.3
`

test('必須見出しが揃っていればエラーなし', () => {
  assert.deepEqual(checkHeadings(validLesson, 'static'), [])
})

test('見出しが欠けていれば、欠けたものだけ報告する', () => {
  const broken = validLesson.replace('## つまずきポイント\n', '')
  const errors = checkHeadings(broken, 'static')
  assert.equal(errors.length, 1)
  assert.match(errors[0], /つまずきポイント/)
})

test('必須見出しは 5 つである', () => {
  assert.equal(LESSON_HEADINGS.length, 5)
})

test('prose モードは H1 だけを要求する', () => {
  assert.deepEqual(checkHeadings('# L00 このコースについて\n\n本文', 'prose'), [])
})

test('prose モードで H1 が無ければエラー', () => {
  const errors = checkHeadings('本文だけ', 'prose')
  assert.equal(errors.length, 1)
})

test('正しい検証フッターを受け入れる', () => {
  assert.deepEqual(checkFooter(validLesson, 'static'), [])
})

test('検証フッターが無ければエラー', () => {
  const errors = checkFooter(validLesson.replace(/検証：.*/, ''), 'static')
  assert.equal(errors.length, 1)
})

test('日付の書式が不正ならエラー', () => {
  const broken = validLesson.replace('2026-09-08', '2026/09/08')
  const errors = checkFooter(broken, 'static')
  assert.equal(errors.length, 1)
})

test('prose モードは検証フッターを要求しない', () => {
  assert.deepEqual(checkFooter('# L00\n\n本文', 'prose'), [])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `./structure.mjs` が見つからない。

- [ ] **Step 3: Write minimal implementation**

Create `scripts/checks/structure.mjs`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — Task 2 の 9 件と合わせて 18 tests pass。

- [ ] **Step 5: Commit**

```bash
git add scripts/checks/structure.mjs scripts/checks/structure.test.mjs
git commit -m "feat: レッスン README の必須見出しと検証フッターをチェックする

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: コンテンツチェックと lint CLI

**Files:**
- Create: `scripts/checks/content.mjs`
- Create: `scripts/lint.mjs`
- Test: `scripts/checks/content.test.mjs`
- Modify: `package.json`（`scripts` セクション）

**Interfaces:**
- Consumes: Task 2 の `loadManifest`、`validateManifest`、`reconcileWithDisk`／Task 3 の `checkHeadings`、`checkFooter`
- Produces:
  - `findCdnPins(html): {pkg, version}[]`
  - `checkExactVersions(html): string[]`
  - `checkVersionConsistency(filesWithPins): string[]` — `filesWithPins` は `{file, pins}[]`
  - `findLocalLinks(markdown): string[]`
  - `lint(root): Promise<string[]>`（`scripts/lint.mjs`、エラー配列を返す）

- [ ] **Step 1: Write the failing test**

Create `scripts/checks/content.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `./content.mjs` が見つからない。

- [ ] **Step 3: Write minimal implementation**

Create `scripts/checks/content.mjs`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 合計 33 tests pass。

- [ ] **Step 5: lint CLI を書く**

Create `scripts/lint.mjs`:

```js
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
```

- [ ] **Step 6: `package.json` に scripts を追加する**

`package.json` の `"scripts"` を次の通りに置き換える。webpack 用の `build` / `serve` は R2 のマルチエントリ化で復活させるため、名前を `build:webpack` に退避して残す。

```json
  "scripts": {
    "test": "node --test",
    "lint": "node scripts/lint.mjs",
    "build": "node scripts/build.mjs",
    "serve": "node scripts/serve.mjs",
    "build:webpack": "webpack --config config/webpack.config.js"
  },
```

**引数は付けない。** Node のテストランナーは引数の解釈をメジャーバージョン間で変えており、パスやグロブを渡すと環境依存になる。

- `node --test scripts/`（ディレクトリ指定）— **Node v22 で失敗する。** v22 は引数を glob パターンとして扱うため、`scripts` にマッチするテストファイルが無く、ディレクトリ自体を実行しようとして落ちる
- `node --test "scripts/**/*.test.mjs"`（グロブ指定）— **Node v20 で失敗する。** v20 は glob 展開に対応していない

引数なしの `node --test` だけが v18 / v20 / v22 のすべてで同じ意味を持ち、カレントディレクトリ以下のテストファイルを再帰的に探索する。CI は Node 20、著者環境は Node 22 であり、両方で動く形はこれしかない。

- [ ] **Step 7: lint が現状を正しく落とすことを確認する**

Run: `npm run lint`
Expected: FAIL（exit 1）。`00-about: README.md がありません` など、manifest に登録済みだがディスクに無いレッスンが 5 件報告される。**この失敗は正しい** — Task 9 以降でレッスンを作ると解消する。

- [ ] **Step 8: Commit**

```bash
git add scripts/checks/content.mjs scripts/checks/content.test.mjs scripts/lint.mjs package.json
git commit -m "feat: 浮動バージョンとリンク切れを検出する lint を追加

CDN の範囲指定（@1 など）とレッスン間のバージョン不一致を
機械的に検出する。教材が黙って古びることを防ぐ。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: ビルドスクリプトと索引ページ生成

**Files:**
- Create: `scripts/build.mjs`
- Test: `scripts/build.test.mjs`

**Interfaces:**
- Consumes: Task 2 の `loadManifest`、`publishedLessons`
- Produces:
  - `renderIndex(lessons): string` — 索引ページの HTML を返す純粋関数
  - `build(root, outDir): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `scripts/build.test.mjs`:

```js
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {renderIndex} from './build.mjs'

const lessons = [
  {id: '00-about', title: 'このコースについて', dir: 'lessons/00-about', mode: 'prose', status: 'published'},
  {id: '01-first-ar', title: '最初の AR', dir: 'lessons/01-first-ar', mode: 'static', status: 'published'},
]

test('索引に全レッスンのタイトルが出る', () => {
  const html = renderIndex(lessons)
  assert.match(html, /このコースについて/)
  assert.match(html, /最初の AR/)
})

test('static レッスンは index.html へリンクする', () => {
  assert.match(renderIndex(lessons), /href="\.\/lessons\/01-first-ar\/"/)
})

test('prose レッスンは README.md へリンクする', () => {
  assert.match(renderIndex(lessons), /href="\.\/lessons\/00-about\/README\.md"/)
})

test('日本語ページとして lang と charset を宣言する', () => {
  const html = renderIndex(lessons)
  assert.match(html, /<html lang="ja">/)
  assert.match(html, /charset="utf-8"/i)
})

test('タイトルに含まれる HTML 特殊文字をエスケープする', () => {
  const html = renderIndex([{...lessons[0], title: '<script>alert(1)</script>'}])
  assert.doesNotMatch(html, /<script>alert/)
  assert.match(html, /&lt;script&gt;/)
})

test('レッスンが空でも壊れない', () => {
  assert.match(renderIndex([]), /<html lang="ja">/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `./build.mjs` が見つからない。

- [ ] **Step 3: Write minimal implementation**

Create `scripts/build.mjs`:

```js
// dist/ を生成する。R1 のレッスンは全てビルドレスであるためコピーと索引生成のみ。
// R2 で bundled レッスンが増えたら、ここから webpack を呼び出す形に拡張する。

import {cp, mkdir, rm, writeFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadManifest, publishedLessons} from './manifest.mjs'

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
  await cp(sharedDir, path.join(outDir, 'shared'), {recursive: true, force: true}).catch(() => {
    // shared/ がまだ無い段階では何もしない
  })

  await writeFile(path.join(outDir, 'index.html'), renderIndex(lessons), 'utf8')
  console.log(`✓ build: ${lessons.length} 件のレッスンを ${outDir} に出力しました`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(fileURLToPath(import.meta.url), '..', '..')
  await build(root, path.join(root, 'dist'))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 合計 39 tests pass。

- [ ] **Step 5: ビルドが空の状態で成功することを確認する**

Run: `npm run build`
Expected: `✓ build: 0 件のレッスンを ... に出力しました`（全レッスンが `draft` のため 0 件で正しい）。

さらに次の 2 点を確認する。

- `dist/index.html` が生成されていること
- **`dist/external/scripts/8frame-1.5.0.min.js` が存在すること** — レッスンはここから A-Frame を読み込むため、欠けていると公開後に全レッスンが動かない

- [ ] **Step 6: Commit**

```bash
git add scripts/build.mjs scripts/build.test.mjs
git commit -m "feat: manifest から dist と索引ページを生成するビルドを追加

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: ローカル静的サーバ

**Files:**
- Create: `scripts/serve.mjs`
- Test: `scripts/serve.test.mjs`

**Interfaces:**
- Consumes: Task 5 の `build`
- Produces:
  - `resolveSafePath(root, urlPath): string | null` — root の外へ出るパスには `null` を返す
  - `contentTypeFor(filePath): string`
  - `startServer(root, port): http.Server`

- [ ] **Step 1: Write the failing test**

Create `scripts/serve.test.mjs`:

```js
import {test} from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import {resolveSafePath, contentTypeFor} from './serve.mjs'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `./serve.mjs` が見つからない。

- [ ] **Step 3: Write minimal implementation**

Create `scripts/serve.mjs`:

```js
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
      if (info.isDirectory()) throw new Error('directory')
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — 合計 47 tests pass。

- [ ] **Step 5: 実際に起動して確認する**

Run: `npm run serve`
ブラウザで `http://localhost:8080` を開く。
Expected: 索引ページが表示される（レッスンは全て `draft` なので一覧は空）。確認後 Ctrl+C で停止する。

- [ ] **Step 6: Commit**

```bash
git add scripts/serve.mjs scripts/serve.test.mjs
git commit -m "feat: 依存を増やさないローカル静的サーバを追加

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: CI と GitHub Pages デプロイ

**Files:**
- Modify: `package.json`（`test` スクリプトを CI の Node 20 でも動く形にする）
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm test`、`npm run lint`、`npm run build`（Task 4〜6）
- Produces: `main` への push で `dist/` が GitHub Pages に公開される

README が謳っていた GitHub Actions の設定は**このリポジトリには存在しない**ため、新規に作成する。

- [ ] **Step 1: `test` スクリプトを Node 20 でも動く形に直す**

`package.json` の `test` を次のとおり書き換える。

```json
    "test": "node --test",
```

**なぜこれが CI の作業に含まれるのか。** 現在の値は `node --test "scripts/**/*.test.mjs"` で、著者環境の Node 22 では動くが **CI が固定する Node 20 では glob が展開されず失敗する**。逆に、それ以前の `node --test scripts/` は Node 20 では動くが Node 22 で失敗する。引数なしの `node --test` だけが両方で同じ意味を持ち、カレントディレクトリ以下を再帰探索する。CI を green にすることがこのタスクの目的である以上、この 1 行はここで直すのが正しい。

他の 4 つのスクリプト（`lint` / `build` / `serve` / `build:webpack`）は変更しない。

- [ ] **Step 2: CI ワークフローを作成する**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: テスト
        run: npm test
      - name: 様式チェック
        run: npm run lint
      - name: ビルド
        run: npm run build
```

`npm ci` を実行しない点に注意する。R1 のスクリプトは Node 標準モジュールのみで動作し、`node_modules` を必要としない。

- [ ] **Step 3: デプロイワークフローを作成する**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: ビルド
        run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: ローカルで CI と同じ手順を通す**

Run: `npm test && npm run lint && npm run build`
Expected: `npm test` は PASS、`npm run lint` は **exit 1 で FAIL**（レッスンが未作成のため）。

この時点で CI を green にはできない。**これは想定通りであり、Task 9 以降でレッスンを作ると解消する。** CI を通すためだけに lint を緩めてはならない。

- [ ] **Step 5: Commit**

```bash
git add package.json .github/workflows/ci.yml .github/workflows/deploy.yml
git commit -m "ci: テスト・lint・ビルドと GitHub Pages デプロイを追加

README が言及していた Actions 設定は実在しなかったため新規作成した。

あわせて test スクリプトを引数なしの node --test に変更した。
Node はテストランナーの引数解釈をメジャーバージョン間で変えており、
ディレクトリ指定は v22 で、glob 指定は v20 で失敗する。CI は Node 20、
著者環境は Node 22 のため、両方で動く形は引数なししかない。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: 実機検証スパイク — ポートフォワーディング仮説の確定

**Files:**
- Create: `docs/superpowers/plans/verified-head-snippet.html`
- Create: `docs/superpowers/plans/2026-09-08-device-verification-notes.md`

**Interfaces:**
- Consumes: Task 6 の `npm run serve`
- Produces: `verified-head-snippet.html` — **実機で動作を確認済みの `<head>` 内スクリプトタグ一式**。Task 9〜12 はこれを逐語的にコピーして使う。

**このタスクは調査であり、結論は「動いた／動かなかった」のどちらでもよい。** 設計 第13節が未検証と明記している仮説を、ここで確定させる。レッスンを書く前に必ず完了させること。

- [ ] **Step 1: 配布されている実際のバージョンを調べる**

Run:
```bash
npm view @8thwall/xrextras version
npm view @8thwall/engine-binary version
npm view @8thwall/landing-page version
```
Expected: 各パッケージの厳密なバージョン番号が出力される。**この 3 つの数値を控える。** 以降のレッスンは全てこの版に固定する。

いずれかが存在しない場合は `npm view <pkg> versions --json` で配布状況を確認し、結果を Step 6 のノートに記録する。

- [ ] **Step 2: 検証用の最小ページを作る**

Create `lessons/01-first-ar/index.html`（Task 9 で内容を仕上げるため、ここでは検証用の最小構成）:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>L01 最初の AR</title>
  <!-- Step 1 で調べた厳密バージョンに置き換えること。範囲指定（@1 など）は lint で弾かれる -->
  <script src="../../external/scripts/8frame-1.5.0.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@8thwall/xrextras@VERSION_FROM_STEP_1/dist/xrextras.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@VERSION_FROM_STEP_1/dist/xr.js" async data-preload-chunks="slam"></script>
</head>
<body>
  <a-scene xrextras-loading xrextras-runtime-error xrweb="allowedDevices: any">
    <a-box position="0 1 -3" scale="0.5 0.5 0.5" color="#e05a47"></a-box>
    <a-light type="ambient" intensity="1"></a-light>
    <a-camera position="0 2 0"></a-camera>
  </a-scene>
</body>
</html>
```

`VERSION_FROM_STEP_1` は Step 1 で得た実際の数値に置き換える。**この文字列を残したままコミットしてはならない。**

- [ ] **Step 3: PC で動作を確認する**

Run: `npm run serve`（別ターミナルで起動したまま）

`lessons/manifest.json` の `01-first-ar` の `status` を一時的に `published` に変更してから再度 `npm run serve` を実行し、`http://localhost:8080/lessons/01-first-ar/` を PC Chrome で開く。

Expected: カメラ許可を求められ、許可すると赤い箱が表示される。DevTools の Console にエラーが出ないこと。

- [ ] **Step 4: Android のポートフォワーディングを検証する（本タスクの核心）**

1. Android 端末で開発者オプションと USB デバッグを有効にする
2. USB で PC に接続する
3. PC Chrome で `chrome://inspect/#devices` を開く
4. 「Port forwarding」で `8080` → `localhost:8080` を設定し、有効化する
5. Android の Chrome で `http://localhost:8080/lessons/01-first-ar/` を開く

Expected（仮説）: `localhost` は secure context として扱われるため、**証明書もトンネルも無しでカメラが起動し、赤い箱が表示される**。

**成立した場合:** この手順を L01 の正式手順として採用する。
**成立しなかった場合:** ngrok 手順にフォールバックする。既存の `config/webpack.config.js` の `allowedHosts` に `.ngrok-free.dev` が入っているのはこの前提によるものである。どちらを採用したかを Step 6 のノートに記録し、**L01 には採用した方法だけを書く**（初学者に選択肢を出すと詰まるため併記しない）。

- [ ] **Step 5: 検証済みスニペットを確定させる**

Create `docs/superpowers/plans/verified-head-snippet.html` に、Step 4 で実際に動作した `<head>` 内のスクリプトタグを**そのまま**保存する。バージョン番号は実数値であること。

Task 9〜12 はこのファイルの内容を逐語的にコピーする。これにより全レッスンのバージョンが自動的に一致し、Task 4 の `checkVersionConsistency` を通過する。

- [ ] **Step 6: 検証ノートを書く**

Create `docs/superpowers/plans/2026-09-08-device-verification-notes.md` に次を記録する。

- 各パッケージの確定バージョン
- 検証日
- Android 端末の機種と Chrome のバージョン
- ポートフォワーディングが成立したか
- 成立しなかった場合、代わりに採用した手順と、その手順で動作を確認した証跡
- 途中で詰まった点（L01 の「つまずきポイント」の一次資料になる）

- [ ] **Step 7: 検証用の一時変更を戻す**

`lessons/manifest.json` の `01-first-ar` の `status` を `draft` に戻す。`lessons/01-first-ar/index.html` は Task 9 で仕上げるため残してよい。

- [ ] **Step 8: Commit**

```bash
git add docs/superpowers/plans/ lessons/01-first-ar/index.html lessons/manifest.json
git commit -m "docs: 実機検証スパイクの結果と確定バージョンを記録

Chrome のポートフォワーディングでカメラが動作するかという
設計上の未検証事項を実機で確定させた。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: L01 最初の AR

**Files:**
- Modify: `lessons/01-first-ar/index.html`
- Create: `lessons/01-first-ar/README.md`
- Modify: `lessons/manifest.json`

**Interfaces:**
- Consumes: Task 8 の `verified-head-snippet.html`（逐語コピー）／Task 8 の検証ノート（つまずきポイントの一次資料）
- Produces: 以降のレッスンが踏襲する README の実例

- [ ] **Step 1: index.html を仕上げる**

`lessons/01-first-ar/index.html` の `<head>` 内スクリプトを `docs/superpowers/plans/verified-head-snippet.html` の内容で置き換える。本文は Task 8 Step 2 の最小構成を維持する（**このレッスンの主題は「動かすこと」であり、3D の作り込みではない**）。

- [ ] **Step 2: README を書く**

Create `lessons/01-first-ar/README.md`。必須見出し 5 つと検証フッターを含める。

```markdown
# L01 最初の AR

## このレッスンでできるようになること
- HTML 1 枚だけで、カメラ映像の上に 3D オブジェクトを表示できる
- 手元の PC と Android 実機の両方で AR ページを開ける

## 前提
- Android 端末（USB ケーブルで PC に接続できること）
- PC に Chrome が入っていること
- npm も Node.js も**不要**

## まず動かす
（Task 8 で確定した手順のみを書く。採用しなかった方法は書かない）

## 解説
（HTML の各行が何をしているか。a-scene / xrweb / a-camera の役割）

## つまずきポイント
（Task 8 の検証ノートに記録した実際の詰まりを、症状 → 原因 → 対処 の形で書く）

## やってみよう
- 箱の `color` を変えてみる
- `position` の 3 つの数値を変えて、箱がどう動くか観察する

---
検証：（Task 8 で実機確認した日付） / （実機の Chrome バージョン） / engine （確定バージョン）
```

`（...）` の部分は実際の内容に置き換えること。**丸括弧のまま残してはならない。**

- [ ] **Step 3: manifest で published にする**

`lessons/manifest.json` の `01-first-ar` の `status` を `"published"` に変更する。

- [ ] **Step 4: lint とビルドを通す**

Run: `npm run lint && npm run build`
Expected: lint は `01-first-ar` に関するエラーを出さない（未作成の他 4 レッスンのエラーは残る）。ビルドは 1 件を出力する。

- [ ] **Step 5: 実機で確認し、フッターの日付を更新する**

Task 8 で確定した手順で Android 実機を開き、動作を確認する。確認した日付をフッターに書く。**動作を確認していない日付を書いてはならない。**

- [ ] **Step 6: Commit**

```bash
git add lessons/01-first-ar/ lessons/manifest.json
git commit -m "feat(lesson): L01 最初の AR

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: L02 座標系とスケール

**Files:**
- Create: `lessons/02-coordinates/index.html`
- Create: `lessons/02-coordinates/README.md`
- Modify: `lessons/manifest.json`

**Interfaces:**
- Consumes: `verified-head-snippet.html`（Task 8）／L01 の README 様式（Task 9）
- Produces: なし（後続レッスンは独立している）

- [ ] **Step 1: index.html を作る**

`<head>` は `verified-head-snippet.html` を逐語コピーする。シーンには、座標の違いが目で分かるよう**色分けした 3 つの箱**を x / y / z 軸方向に配置し、スケール比較用に大小 2 つの球を置く。

```html
<a-scene xrextras-loading xrextras-runtime-error xrweb="allowedDevices: any">
  <!-- x 軸方向（赤）／ y 軸方向（緑）／ z 軸方向（青） -->
  <a-box position="1 1 -3" scale="0.3 0.3 0.3" color="#e05a47"></a-box>
  <a-box position="0 2 -3" scale="0.3 0.3 0.3" color="#4caf50"></a-box>
  <a-box position="0 1 -4" scale="0.3 0.3 0.3" color="#3f7fd0"></a-box>

  <!-- スケール比較: 1 単位 = 1 メートル -->
  <a-sphere position="-1 1 -3" radius="0.1" color="#888"></a-sphere>
  <a-sphere position="-2 1 -3" radius="1" color="#ccc"></a-sphere>

  <a-light type="ambient" intensity="1"></a-light>
  <a-camera position="0 2 0"></a-camera>
</a-scene>
```

- [ ] **Step 2: README を書く**

必須見出し 5 つと検証フッターを含める。「解説」で次の 3 点を必ず扱う。

1. A-Frame の座標系は右手系 Y-up であること（`position="x y z"` の順、-z が奥）
2. **AR では 1 単位 = 1 メートルとして扱われる**こと
3. **カメラの初期 Y 位置が仮想コンテンツの実効スケールを決める**こと。`a-camera` の `position` の Y を小さくすると相対的にコンテンツが大きく見える。**Y を 0 にしてはならない**（8th Wall の既知の制約）

「つまずきポイント」には最低 1 件、**カメラの Y を 0 にした場合の症状**を書く。

- [ ] **Step 3: manifest で published にする**

`lessons/manifest.json` の `02-coordinates` の `status` を `"published"` に変更する。

- [ ] **Step 4: lint とビルドを通す**

Run: `npm run lint && npm run build`
Expected: `02-coordinates` に関するエラーが出ないこと。

- [ ] **Step 5: 実機で確認し、フッターの日付を更新する**

Android 実機で開き、箱の位置関係と球の大小が説明と一致することを確認する。確認した日付をフッターに書く。

- [ ] **Step 6: Commit**

```bash
git add lessons/02-coordinates/ lessons/manifest.json
git commit -m "feat(lesson): L02 座標系とスケール

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: L03 マテリアルとライト

**Files:**
- Create: `lessons/03-materials-lights/index.html`
- Create: `lessons/03-materials-lights/README.md`
- Modify: `lessons/manifest.json`

**Interfaces:**
- Consumes: `verified-head-snippet.html`（Task 8）／L01 の README 様式（Task 9）
- Produces: なし

- [ ] **Step 1: index.html を作る**

`<head>` は `verified-head-snippet.html` を逐語コピーする。シーンでは、**同じ形状に異なるマテリアルを与えて並べ**、ライトの効き方の違いを 1 画面で比較できるようにする。

```html
<a-scene xrextras-loading xrextras-runtime-error xrweb="allowedDevices: any">
  <!-- 左: ライトの影響を受けない flat シェーダー -->
  <a-sphere position="-0.8 1.2 -3" radius="0.3" material="shader: flat; color: #e05a47"></a-sphere>
  <!-- 中央: 標準マテリアル（金属感なし） -->
  <a-sphere position="0 1.2 -3" radius="0.3" material="color: #e05a47; metalness: 0; roughness: 0.6"></a-sphere>
  <!-- 右: 金属質 -->
  <a-sphere position="0.8 1.2 -3" radius="0.3" material="color: #e05a47; metalness: 1; roughness: 0.2"></a-sphere>

  <!-- 影を受ける床 -->
  <a-plane position="0 0 -3" rotation="-90 0 0" width="4" height="4"
           material="shader: shadow; transparent: true; opacity: 0.3" shadow></a-plane>

  <a-light type="ambient" intensity="0.4"></a-light>
  <a-light type="directional" intensity="0.8" position="1 3 2" castShadow="true"></a-light>
  <a-camera position="0 2 0"></a-camera>
</a-scene>
```

- [ ] **Step 2: README を書く**

必須見出し 5 つと検証フッターを含める。「まず動かす」の直後に**3 つの球の見た目が違う理由**を問いかけ、「解説」で答える構成にする。

「つまずきポイント」には最低 2 件、次を必ず含める。

> **症状:** モデルが真っ黒に見える
> **原因:** シーンに `light` を 1 つでも書くと A-Frame のデフォルトライトが無効化される。`directional` だけを置くと、光の当たらない面が完全な黒になる
> **対処:** `ambient` ライトを併せて置く

> **症状:** 影がまったく出ない
> **原因:** 影は「落とす側」と「受ける側」の両方の指定が要る
> **対処:** 光源に `castShadow`、受ける面に `shadow` を指定する

- [ ] **Step 3: manifest で published にする**

`lessons/manifest.json` の `03-materials-lights` の `status` を `"published"` に変更する。

- [ ] **Step 4: lint とビルドを通す**

Run: `npm run lint && npm run build`
Expected: `03-materials-lights` に関するエラーが出ないこと。

- [ ] **Step 5: 実機で確認し、フッターの日付を更新する**

Android 実機で 3 つの球の差と床の影を確認する。確認した日付をフッターに書く。

- [ ] **Step 6: Commit**

```bash
git add lessons/03-materials-lights/ lessons/manifest.json
git commit -m "feat(lesson): L03 マテリアルとライト

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: L04 ECS と独自コンポーネント

**Files:**
- Create: `lessons/04-ecs-components/index.html`
- Create: `lessons/04-ecs-components/README.md`
- Modify: `lessons/manifest.json`

**Interfaces:**
- Consumes: `verified-head-snippet.html`（Task 8）／L01 の README 様式（Task 9）
- Produces: 第 1 章の到達点。R2 の L05 はここから webpack へ移行する

- [ ] **Step 1: index.html を作る**

`<head>` は `verified-head-snippet.html` を逐語コピーする。**独自コンポーネントをインラインの `<script>` で登録する**（このレッスンの主題が「ビルド無しでコンポーネントを書けること」であるため）。

```html
<script>
  // タップされた床の上にオブジェクトを生やす独自コンポーネント。
  // A-Frame では、振る舞いはコンポーネントとして書き、エンティティに付けて使う。
  AFRAME.registerComponent('tap-place', {
    schema: {
      color: {default: '#e05a47'},
    },
    init() {
      const ground = document.getElementById('ground')

      ground.addEventListener('click', event => {
        const box = document.createElement('a-box')

        // レイキャスターが、タップ位置に対応するシーン内の座標を教えてくれる
        box.setAttribute('position', event.detail.intersection.point)
        box.setAttribute('scale', '0.2 0.2 0.2')
        box.setAttribute('color', this.data.color)

        this.el.sceneEl.appendChild(box)
      })
    },
  })
</script>
```

`<body>` 側は、`cantap` クラスを付けた床と、`raycaster` を設定したカメラを置く。

```html
<a-scene tap-place xrextras-loading xrextras-runtime-error xrweb="allowedDevices: any">
  <a-light type="ambient" intensity="1"></a-light>

  <!-- raycaster が cantap クラスの要素に対して click を発火させる -->
  <a-camera position="0 2 0" raycaster="objects: .cantap" cursor="fuse: false; rayOrigin: mouse"></a-camera>

  <a-plane id="ground" class="cantap" position="0 0 0" rotation="-90 0 0" width="20" height="20"
           material="shader: shadow; transparent: true; opacity: 0.3"></a-plane>
</a-scene>
```

- [ ] **Step 2: README を書く**

必須見出し 5 つと検証フッターを含める。「解説」で ECS の 3 語を、**A-Frame の実物と対応づけて**説明する。

- エンティティ = `<a-entity>`（それ自体は何もしない入れ物）
- コンポーネント = `position` や `tap-place` などの属性（振る舞いとデータ）
- システム = 同種のコンポーネントをまとめて扱う仕組み（このレッスンでは使わないが名前だけ紹介する）

`schema` / `init` / `this.data` / `this.el` の 4 つを、上のコードのどこに対応するかを示しながら説明する。

「つまずきポイント」には最低 1 件、次を含める。

> **症状:** 床をタップしても何も出ない
> **原因:** `raycaster` は指定したクラスの要素しか対象にしない。床に `cantap` クラスが付いていないか、カメラの `raycaster="objects: .cantap"` が抜けている
> **対処:** 両方が揃っているか確認する

- [ ] **Step 3: manifest で published にする**

`lessons/manifest.json` の `04-ecs-components` の `status` を `"published"` に変更する。

- [ ] **Step 4: lint とビルドを通す**

Run: `npm run lint && npm run build`
Expected: `04-ecs-components` に関するエラーが出ないこと。

- [ ] **Step 5: 実機で確認し、フッターの日付を更新する**

Android 実機で床をタップし、箱が生成されることを確認する。確認した日付をフッターに書く。

- [ ] **Step 6: Commit**

```bash
git add lessons/04-ecs-components/ lessons/manifest.json
git commit -m "feat(lesson): L04 ECS と独自コンポーネント

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: L00 このコースについて と ルート README

**Files:**
- Create: `lessons/00-about/README.md`
- Modify: `README.md`（8th Wall サンプルの README を全面的に置き換える）
- Modify: `lessons/manifest.json`

**Interfaces:**
- Consumes: Task 9〜12 の全レッスン（内容が確定してから書く）
- Produces: コースの入口

L00 とルート README は**最後に書く**。全レッスンが揃ってからでないと、正確な目次も所要時間も書けない。

- [ ] **Step 1: L00 を書く**

Create `lessons/00-about/README.md`。`mode` は `prose` なので必須見出しは H1 のみだが、次の内容を必ず含める。

- **8th Wall の現在地** — 2026-02-28 にホスティング事業が終了し、無償・オープンソースへ移行した。アカウントも App Key も不要。ネット上の既存チュートリアルの大半は、消滅したクラウドエディタを前提としており再現できない
- **動く機能と動かない機能** — 動く: World Effects、Absolute Scale、Image Targets、Face Effects、Sky Effects。動かない: VPS、クラウド画像認識、8th Wall によるホスティング
- **検証環境の明示** — 「Android Chrome と PC で検証しています。**iOS は未検証であり、動作を保証しません**」
- **ライセンス 3 層** — 本文は CC BY 4.0、コードは MIT、**8th Wall XR Engine は無償だが商用利用に制限がある**（業務利用を検討する読者が最初に知るべき情報なので、曖昧にしない）
- **目次** — 各レッスンへの相対リンク

**`8thwall.com` および `8th.io` へのリンクを書いてはならない**（Global Constraints）。

- [ ] **Step 2: ルート README を全面的に書き換える**

現在の `README.md` は 8th Wall サンプルのものであり、**このプロジェクトについて誤った記述を含む**（存在しない GitHub Actions 設定への言及、消滅した `8th.io` の QR リンク、削除済み Sketchfab モデルへの attribution）。全面的に置き換える。

新しい README に含めるもの:

- コースの 1 行説明と対象読者（「Web 開発はできるが 3D は初めて」）
- 目次（L00〜L04 への相対リンク、R2 以降は「準備中」と明記）
- 最短の始め方（第 1 章は npm 不要である旨を最初に書く）
- 検証環境（Android Chrome + PC、iOS 未検証）
- ライセンス 3 層
- サンプルコードの由来（8th Wall / Niantic Spatial の MIT ライセンスを継承している旨）

- [ ] **Step 3: manifest で published にする**

`lessons/manifest.json` の `00-about` の `status` を `"published"` に変更する。

- [ ] **Step 4: lint とビルドを通す**

Run: `npm test && npm run lint && npm run build`
Expected: **3 つとも成功する。** これが R1 で初めて lint が green になる瞬間である。ビルドは 5 件のレッスンを出力する。

- [ ] **Step 5: 禁止ドメインが残っていないことを確認する**

Run:
```bash
grep -rn "8thwall\.com\|8th\.io" --include="*.md" --include="*.html" --include="*.json" . ; echo "exit=$?"
```
Expected: `node_modules` と `dist` を除いて**何も出力されず** `exit=1` になること。1 件でも出た場合は書き換える（Global Constraints）。

- [ ] **Step 6: Commit**

```bash
git add lessons/00-about/ README.md lessons/manifest.json
git commit -m "docs: L00 とコースのルート README を追加

サンプル由来の README を全面的に置き換えた。存在しない Actions 設定、
消滅した 8th.io の QR、削除済み Sketchfab モデルへの attribution を除去。

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: R1 リリース

**Files:**
- Modify: 各レッスンの `README.md`（検証フッターの日付のみ）

**Interfaces:**
- Consumes: Task 1〜13 の全成果
- Produces: 公開された R1

- [ ] **Step 1: 章単位の通し実機検証**

Android 実機で L01 → L02 → L03 → L04 を**順番に、README の手順どおりに**実行する。レッスン単位ではなく通しで行うのは、レッスン間の手順の断絶を見つけるためである。

詰まった箇所を全て記録する。記録した内容は各レッスンの「つまずきポイント」に反映する。

- [ ] **Step 2: 検証フッターを揃える**

Step 1 で通しの動作を確認した日付で、L01〜L04 のフッターを更新する。**通していないレッスンの日付を更新してはならない。**

- [ ] **Step 3: 最終チェックを通す**

Run: `npm test && npm run lint && npm run build`
Expected: 3 つとも成功する。

- [ ] **Step 4: Commit と push**

```bash
git add lessons/
git commit -m "docs: R1 の通し実機検証を反映

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push -u origin main
```

- [ ] **Step 5: GitHub Pages を有効化する**

リポジトリの Settings → Pages → Source を「GitHub Actions」に設定する。`deploy.yml` が動作し、索引ページが公開されることを確認する。

- [ ] **Step 6: 成功基準を計測する**

設計 第 2 節の成功基準 1 を実測する。

**8th Wall 未経験の Web 開発者 1 名に、README だけを渡して Android 実機に AR を表示してもらう。** 口頭で補足してはならない。補足したくなった箇所こそが README の欠陥である。

詰まった箇所を全て記録し、README に反映する。この計測を行うまで R1 は完了とみなさない。

---

## Self-Review

**1. Spec coverage（R1 の範囲）**

| 設計の要求 | 対応タスク |
|---|---|
| 復元点の作成 | Task 1（**アーカイブ方式へ変更**。逸脱として明記済み） |
| `.gitattributes` の LFS パス修正 | Task 1 Step 4 |
| `dev/null/` の削除 | Task 1 Step 5 |
| `manifest.json` を単一の真実とする | Task 2 |
| 必須見出しと検証フッターのチェック | Task 3 |
| 浮動バージョン検出 | Task 4 |
| 内部リンク切れ検出 | Task 4 |
| manifest ↔ ディスクの整合 | Task 2 + Task 4 |
| ビルドと索引ページ生成 | Task 5 |
| CI（build + lint + test） | Task 7 |
| GitHub Pages デプロイ | Task 7、Task 14 Step 5 |
| ポートフォワーディング仮説の検証 | Task 8 |
| L00〜L04 の執筆 | Task 9〜13 |
| 「検証済み」を実機通過に紐づける | Task 9〜12 Step 5、Task 14 Step 2 |
| 章単位の実機検証 | Task 14 Step 1 |
| 検証不能アセットの除外 | Task 1 Step 5 |
| `8thwall.com` / `8th.io` 依存ゼロ | Task 13 Step 5（機械的に確認） |
| ライセンス 3 層の明示 | Task 13 Step 1 |
| 成功基準の計測 | Task 14 Step 6 |

**R2 以降へ繰り延べた設計要求**（意図的、逸脱として明記済み）: webpack のマルチエントリ化、QR のビルド時生成、`src/` の `lessons/06-tap-to-place/` への移動、`shared/assets/` の実運用。

**2. Placeholder scan**

Task 8 Step 2 の `VERSION_FROM_STEP_1` は、Step 1 で取得する実際の値に置き換える指示を同じステップ内に明記し、「この文字列を残したままコミットしてはならない」と警告している。実際のバージョン番号は**執行時にしか判明しない**ため、計画側で数値を創作することはできない。Task 8 が確定させ、Task 9〜12 は `verified-head-snippet.html` を逐語コピーする設計により、全レッスンのバージョン一致が構造的に保証される。

Task 9 Step 2 の README 雛形にある `（...）` も、同ステップ内で「丸括弧のまま残してはならない」と明示している。

**3. Type consistency**

- `Lesson` の 5 フィールド（`id` / `title` / `dir` / `mode` / `status`）は Task 2 で定義し、Task 4・5 で同名のまま使用している
- `mode` の値（`prose` / `static` / `bundled`）は Task 2 の `MODES` が唯一の定義であり、Task 3 の `checkHeadings` / `checkFooter`、Task 4 の `lint`、Task 5 の `linkFor` が同じ値で分岐している
- `status` の値（`published` / `draft`）は Task 2 の `STATUSES` が定義し、`publishedLessons` と各レッスンタスクの Step 3 が使用している
- `checkVersionConsistency` の引数形状 `{file, pins}[]` は Task 4 のテストと `lint` の `filesWithPins` で一致している
- `findCdnPins` の戻り値 `{pkg, version}[]` は `checkExactVersions` と `checkVersionConsistency` の双方で同じ形状である
- `npm run build` / `npm run serve` / `npm run lint` / `npm test` は Task 4 Step 6 で定義し、Task 5〜7 および各レッスンタスクで同じ名前で参照している
