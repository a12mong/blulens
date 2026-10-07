# Dev FE packet template (Andy → Ryan / Phyllis)

> กฎ: 1 packet = **1 component หรือ 1 page** เท่านั้น · Dev ใช้ model เล็ก จึงต้องเขียนให้ครบในตัว ไม่ต้องไปอ่านบริบทเพิ่ม · ขาดช่องใดให้ `query` ขึ้นมาหา Andy ห้ามเดา
> ตัวแพ็กเก็ตเป็นภาษาอังกฤษ (ข้อความระหว่าง agent) — เอกสารนี้คำอธิบายเป็นไทย

## รูปแบบ (copy ไปเติม)

```
PACKET <card-id>-<n>: <ComponentName | page route>

GOAL:
  One sentence. What the user can see/do when this is done.

STATE:
  Branch to create: dev-fe/<card-id>-<slug>   (from develop; never commit to main/develop)
  Already exists (do not rewrite): <paths>
  Depends on (merged): <packet ids or "none">

SOURCES:
  - Visual source: docs/design/stitch/<screen>/ (Stitch HTML/CSS + screenshots). PORT it into our Next.js component using our tokens; do NOT copy-paste Stitch markup.
  - Design spec section: <path#section>   (copy of the relevant tokens/layout pasted below if short)
  - API endpoint(s): <METHOD /api/...> + response zod schema: <path in packages/shared>
  - Sibling component to copy the pattern from: <path>

SPEC:
  File(s) to create/touch (ONLY these):
    - <apps/web/components/ui/Foo.tsx>
    - <apps/web/components/ui/Foo.test.tsx>
  Component: Foo                               (page: route + file)
  Props (TypeScript, exact):
    type FooProps = { ... }
  States to render (each one explicit):
    - default: ...
    - loading: ...
    - empty: ...
    - error: ... (text: "...")
    - disabled / selected / etc.
  Behaviour: bullet list, one line each (events -> callbacks / hooks called)
  Styling: token names only (e.g. bg-panel, border-line-3); no raw hex
  A11y: role/aria-label/keyboard requirement

CONSTRAINTS:
  - Touch only the files listed. No new dependencies. No `any`. No fetch in components (use hook from features/<domain>/api.ts).
  - No secrets, no .env printing.
  - Commit style: conventional (feat(web): add Foo), small commits.

TOOLS:
  pnpm --filter web test <file> · pnpm --filter web typecheck · pnpm --filter web lint

DONE (the single proving test):
  File: <Foo.test.tsx>
  Test name: "<it renders ... when ...>"
  Asserts: <exact observable assertion(s)>
  Report back (act=done): paths changed, exact commands run + their real output
  (pass/fail counts), anything unverified, anything left open. "Tests pass" alone is not accepted.
```

## ตัวอย่างที่เติมแล้ว (ย่อ)

```
PACKET bl-16-1: GradeBand

GOAL: Show a 15-step grade ladder with the lower..upper range highlighted and a score marker.
STATE: branch dev-fe/bl-16-grade-band; exists: components/ui/Badge.tsx; depends on: none.
SOURCES: design spec §GradeBand (pasted: tiers RK1-RK3 rookie, ...); GradeProjection type in packages/shared/src/grades.ts.
SPEC:
  Files: apps/web/components/ui/GradeBand.tsx, GradeBand.test.tsx
  type GradeBandProps = { lower: GradeKey; upper: GradeKey; score: number; txt?: string }
  States: exact (lower===upper: 1 cell highlighted); range (cells lower..upper highlighted);
          invalid (lower above upper: render nothing + console.error once)
  A11y: root role="img", aria-label="เกรด {lower} ถึง {upper} คะแนน {score}"
CONSTRAINTS: only the 2 files; tokens only; no new deps.
TOOLS: pnpm --filter web test GradeBand
DONE: test "highlights exactly the cells between lower and upper inclusive" —
      render lower=SD1 upper=SD3 → exactly 3 cells have data-active="true".
```

## เช็กลิสต์ของ Andy ก่อนปล่อย packet

- [ ] มีครบ 6 ช่อง (GOAL/STATE/SOURCES/CONSTRAINTS/TOOLS/DONE) + SPEC ที่ระบุ props และ states ทุกอัน
- [ ] ไฟล์ที่แตะ ≤ 3 ไฟล์ (component + test + อย่างมาก 1 ไฟล์ร่วม)
- [ ] มี test เดียวที่พิสูจน์ได้ และ assertion ตรวจได้จริง
- [ ] สเปกที่อ้างอิง (API/design/สมการ) **เจ้าของอนุมัติแล้ว** — ไม่งั้นห้ามสร้าง packet (Core Directive 3)
- [ ] ไม่ต้องให้ Dev อ่านไฟล์นอกรายการ SOURCES

## เช็กลิสต์ review branch (ก่อน merge)

1. `git diff --stat` — แตะเฉพาะไฟล์ใน packet
2. รันคำสั่งใน TOOLS เองอีกครั้ง; ดูผลจริง
3. ตรวจ token/a11y/ไม่มี `any`/ไม่มี fetch ใน component
4. ตรงตาม design spec ทุก state ที่ระบุ
