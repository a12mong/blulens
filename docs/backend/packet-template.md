# Dev BE packet template (Kevin → Angela / Creed / Meredith)

> กฎ: 1 packet = **1 API endpoint หรือ 1 ฟังก์ชัน/โมดูล pure ใน `packages/shared`** เท่านั้น · Dev ใช้ model เล็ก (และ Meredith เป็น Gemini ที่ไม่ได้รับ system prompt ของ hive) จึงต้องเขียนให้ครบในตัว ไม่ต้องไปอ่านบริบทเพิ่ม · ขาดช่องใดให้ `query` ขึ้นมาหา Kevin ห้ามเดา
> ตัวแพ็กเก็ตเป็นภาษาอังกฤษ (ข้อความระหว่าง agent) — เอกสารนี้คำอธิบายเป็นไทย
> วงจร: Dev ทำบน branch → `done` ถึง Kevin → Kevin ขอ review จาก Oscar (Reviewer BE) → merge เข้า `develop` **เฉพาะเมื่อ Oscar APPROVE** (TEAM.md §7)

## รูปแบบ (copy ไปเติม)

```
PACKET <card-id>-<n>: <METHOD /api/v1/path | shared fn name>

GOAL:
  One sentence. What a caller can do when this is done.

STATE:
  Branch to create: dev/<card-id>-<slug>   (from develop; never commit to main/develop)
  Already exists (do not rewrite): <paths: prisma models, guards, services you call>
  Depends on (merged): <packet ids or "none">

SOURCES (everything you need is pasted here or listed; read nothing else):
  - Spec rule(s), pasted verbatim: "<the exact lines from docs/specs/... or the formula>"
  - Contract: openapi operation <operationId> — request/response schema pasted below
  - Zod schema to use/create: packages/shared/src/schemas/<domain>.ts (<SchemaName>)
  - Sibling to copy the pattern from: <apps/api/src/modules/<x>/<x>.controller.ts>

SPEC:
  File(s) to create/touch (ONLY these, max 4):
    - apps/api/src/modules/<domain>/<name>.controller.ts   (or add one method to an existing controller)
    - apps/api/src/modules/<domain>/<name>.service.ts
    - apps/api/test/<name>.e2e-spec.ts
  Endpoint: <METHOD> /api/v1/<path>
  Auth: <@Public() | roles allowed: Committee, ...> + extra rule (e.g. "reviewer must own the assignment")
  Input (zod, exact):
    const <Name>Input = z.object({ ... })
  Output (data inside the envelope, exact):
    { ... }  (envelope { success: true, data } is added by EnvelopeInterceptor — do not add it yourself)
  Errors (each one explicit: HTTP status + code + Thai message):
    - 404 ASSESSMENT_NOT_FOUND "ไม่พบคำขอประเมิน"
    - 409 <CODE> "<ข้อความไทย>"
    - 403 FORBIDDEN (from guard)
  DB effects: tables written, in ONE transaction; audit_logs row: action "<domain.verb>"
  Behaviour: numbered steps, one line each (validate -> load -> check rule -> write -> return)
  For a pure shared function instead of an endpoint:
    Signature (exact TypeScript), input/output types, edge cases with expected return,
    "no Date.now / Math.random / I/O" rule, file packages/shared/src/<domain>/<fn>.ts + <fn>.test.ts

CONSTRAINTS:
  - Touch only the files listed. No new dependencies. No `any`. No raw SQL unless the packet says so.
  - Business math lives in packages/shared and is imported — never re-implemented in apps/api.
  - Throw ApiException (apps/api/src/common/errors/api.exception.ts) with the codes above; never a bare Error.
  - Append-only tables (assessment_results, assessment_transitions, audit_logs): INSERT only.
  - No secrets, no .env printing. Commit style: conventional (feat(api): add POST /assessments), small commits.

TOOLS:
  docker compose up -d (postgres/redis/minio) · pnpm --filter @blulens/api test -- <name>.e2e-spec
  pnpm --filter @blulens/shared test -- <fn> · pnpm lint

DONE (the single proving test):
  File: <apps/api/test/<name>.e2e-spec.ts | packages/shared/src/<domain>/<fn>.test.ts>
  Test name: "<it returns ... when ...>"
  Asserts: <exact status code + body fields / exact numbers>
  Report back (act=done to Kevin): branch name, paths changed, exact commands run + their real output
  (pass/fail counts), anything unverified, anything left open. "Tests pass" alone is not accepted.
```

## ตัวอย่างที่เติมแล้ว (ย่อ — ใช้ได้จริงเมื่อ bl-03 อนุมัติแล้ว)

```
PACKET bl-08-3: projectGrade (shared)

GOAL: Turn (score, margin) into the bad8bit-shaped grade view {lower, upper, center, kind, label}.
STATE: branch dev/bl-08-project-grade; exists: packages/shared/src/grading/grades.ts (GRADES, GradeKey);
       depends on: bl-08-1 (GRADES ladder) merged.
SOURCES: grading.md appendix B.4, pasted:
  a = clamp(floor(score - m), 0, 14) -> lower = GRADES[a]
  b = clamp(ceil(score + m) - 1, 0, 14) -> upper = GRADES[b]
  center = GRADES[clamp(floor(score), 0, 14)]
  kind = exact if b - a = 0, straddle if 1, wide if >= 2
  label = lower if exact; "lower/upper" if straddle; "lower–upper" (U+2013) if wide
SPEC:
  Files: packages/shared/src/grading/project-grade.ts, project-grade.test.ts, packages/shared/src/index.ts (1 export line)
  export function projectGrade(score: number, margin: number): GradeView
  Edge cases: score=7.61 m=0.25 -> S/S/S exact "S"; score=7.83 m=0.63 -> S..S+ straddle "S/S+";
              score=7.83 m=1.66 -> S-..N- wide "S-–N-"; score=0 m=3 -> RK1 lower clamp; score=14.99 m=3 -> P+ upper clamp
  Pure: no Date, no Math.random, no I/O.
CONSTRAINTS: only those 3 files; no new deps.
TOOLS: pnpm --filter @blulens/shared test -- project-grade
DONE: test "projects the grading.md appendix C fixtures exactly" —
      the 3 fixtures above return exactly the listed lower/upper/center/kind/label.
```

## เช็กลิสต์ของ Kevin ก่อนปล่อย packet

- [ ] ครบ 6 ช่อง (GOAL/STATE/SOURCES/CONSTRAINTS/TOOLS/DONE) + SPEC ที่ระบุ input, output, errors ทุกตัว
- [ ] 1 endpoint หรือ 1 ฟังก์ชัน · ไฟล์ที่แตะ ≤ 4 (controller/service/test + อย่างมาก 1 ไฟล์ schema ร่วม)
- [ ] กฎจากสเปก **วางเป็นข้อความเต็ม** ใน SOURCES — ไม่สั่งให้ Dev ไปเปิดอ่านเอง
- [ ] มี test เดียวที่พิสูจน์ได้ และ assertion เป็นค่าที่ตรวจได้จริง (status + field + ตัวเลข)
- [ ] สเปกที่อ้างอิง (API/สมการ/schema) **เจ้าของอนุมัติแล้ว** — ไม่งั้นห้ามสร้าง packet
- [ ] packet ของ Meredith (Gemini): ใส่ path แบบเต็มทุกไฟล์ + ย้ำให้อ่าน inbox/PROTOCOL เอง

## เช็กลิสต์ review branch (Kevin ก่อนส่ง Oscar และก่อน merge)

1. `git diff --stat develop...dev/<branch>` — แตะเฉพาะไฟล์ใน packet
2. รันคำสั่งใน TOOLS เองอีกครั้ง; ดูผลจริง
3. สูตรถูก import จาก `@blulens/shared` ไม่ได้เขียนซ้ำ · error ใช้ code ตาม packet · ไม่มี `any`
4. เขียน DB อยู่ใน transaction เดียว + มีแถว audit · ตาราง append-only ไม่มี update/delete
5. สิทธิ์: มี test อย่างน้อย 1 เคสที่ role ไม่พอได้ 403 (ถ้า packet ระบุ)
6. Oscar APPROVE แล้วเท่านั้น → merge เข้า `develop` (squash, ข้อความ conventional)
