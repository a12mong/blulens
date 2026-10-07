PACKET bl-21-1: normalizeTeamName + suggestTeams (shared, pure) — DEMO SLICE

Assignee: Creed (creed-muxswjfu) · Reviewer: Oscar (oscar-muxt974o) · Senior: Kevin (kevin-muxsqdkp)

GOAL:
  The pure logic behind the team type-ahead (architecture §6.6, A8): normalise a typed team name, and rank existing
  team names/aliases that match it by prefix or by a small typo distance. Kevin wires it into GET /teams/suggest.

STATE:
  Your own worktree. Branch dev/bl-21-suggest-teams from origin/develop.
    git fetch origin && git switch -c dev/bl-21-suggest-teams origin/develop
  Depends on (merged): nothing. This is pure shared code (no Prisma, no Nest).

SOURCES (owner-approved architecture.md §6.6, verbatim intent):
  - Duplicate check by normalising: Unicode NFC, trim, collapse repeated whitespace (incl. NBSP and tab), remove
    zero-width characters, lower-case. Thai digits equal Arabic digits (QA case RG-04: '๑' == '1').
  - Suggestions: normalise, then match by prefix + edit distance <= 2, ordered by closeness. Names AND aliases
    (Thai/English) are searched; the user must pick from the list.

SPEC:
  Files to create/touch (ONLY these 4):
    - packages/shared/src/teams/suggest.ts
    - packages/shared/src/teams/suggest.test.ts
    - packages/shared/src/teams/index.ts          (exactly: export * from './suggest';)
    - packages/shared/src/index.ts                (append exactly one line: export * from './teams';)
  Exports (exact):
    export function normalizeTeamName(input: string): string
    export function editDistance(a: string, b: string): number            // Levenshtein over UTF-16 code units
    export interface TeamNameCandidate { teamId: string; name: string; alias: string | null; key: string }
    export interface TeamSuggestion { teamId: string; name: string; matchedAlias: string | null; distance: number }
    export function suggestTeams(query: string, candidates: readonly TeamNameCandidate[], limit = 8): TeamSuggestion[]
  normalizeTeamName, in this order:
    1. .normalize('NFC')   2. Thai digits U+0E50..U+0E59 -> '0'..'9'   3. remove U+200B, U+200C, U+200D, U+FEFF
    4. replace every run of whitespace (/\s+/ covers space, tab, NBSP) with one space   5. trim   6. toLowerCase()
  suggestTeams:
    1. limit must be an integer 1..20, else RangeError('TEAM_SUGGEST_INVALID_LIMIT').
    2. q = normalizeTeamName(query); if q === '' return [].
    3. For each candidate (candidate.key is ALREADY normalised by the caller):
         distance = 0 if key.startsWith(q) or any word of key (split on ' ') startsWith(q)
                  else, only when q.length >= 4: min(editDistance(q, key), editDistance(q, key.slice(0, q.length)))
                  else no match.
         keep it when distance <= 2.
    4. One suggestion per teamId: keep the best (lowest distance; on a tie prefer the team's own name (alias null),
       then the alias that sorts first with a plain < compare). matchedAlias = candidate.alias of the kept match.
    5. Sort by distance asc, then name (plain < compare), then teamId. Return the first `limit`.
  Edge cases (expected; distances verified by Kevin with a script). Candidates:
      {T1 'Blue Wing' alias null key 'blue wing'}, {T1 'Blue Wing' alias 'บลูวิง' key 'บลูวิง'},
      {T2 'Red Phoenix' null 'red phoenix'}, {T3 'Green Valley' null 'green valley'}, {T4 'Blue Whale' null 'blue whale'}
    - 'blue'        -> [T4 Blue Whale d0, T1 Blue Wing d0]   (name order)
    - '  Blue  Wing​ ' -> [T1 d0, matchedAlias null]
    - 'bleu wing'   -> [T1 d2]                               (Blue Whale is 5 away: excluded)
    - 'red phx'     -> [T2 d1]
    - 'gren'        -> [T3 d1]
    - 'wing'        -> [T1 d0]                               (word prefix)
    - 'บลู'          -> [T1 d0, matchedAlias 'บลูวิง']
    - 'blu' with limit 1 -> [T4]   ;   'z' -> []   ;   '   ' -> []   ;   limit 0 or 21 -> RangeError
    - normalizeTeamName('ทีม๑') === 'ทีม1' ; normalizeTeamName('ＡＢＣ') keeps full-width (no NFKC) -> 'ａｂｃ'
    - editDistance('kitten','sitting') === 3 ; editDistance('', 'abc') === 3
  Pure: no Date, no Math.random, no I/O. Inputs not mutated.

CONSTRAINTS: only the 4 files; no new deps; no `any`; conventional commits (feat(shared): add team name normalisation and suggestions); push.
TOOLS: pnpm --filter @blulens/shared exec vitest run src/teams/suggest.test.ts · pnpm --filter @blulens/shared exec vitest run · pnpm --filter @blulens/shared lint

DONE (the single proving test):
  File: packages/shared/src/teams/suggest.test.ts
  Test name: "suggests teams by prefix, word prefix, alias and small typos, closest first"
  Asserts: the first 7 query cases above exactly (toEqual). Others in further `it` blocks.
  Report back (act=done to kevin-muxsqdkp): branch, commit, `git diff --stat origin/develop...HEAD`, commands + real output.
  This is on the owner's demo path (bl-21): please do it first, now.
