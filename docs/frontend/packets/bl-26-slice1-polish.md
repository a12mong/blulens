# BACKLOG bl-26: slice 1 UX polish (from docs/design/review-slice-1.md, Pam)

Each row becomes one packet when picked up. Slice 2 (bl-24) has priority. Branch prefix `fe/bl-26-*`.

| Pam # | Item | Files | Owner | Status |
|---|---|---|---|---|
| 1 | Admin entries pages 404 (malformed folders) | app/(app)/admin/events/[eventId]/entries | Andy | DONE (moved earlier, smoke green) |
| 2 | Forward must not reset the form before warnings are shown (show warnings panel, then "สร้างคู่ใหม่") | features/entries/AdminEntryForm.tsx | Ryan | todo |
| 3 | Committee approve: row detail (players, grades, warnings) + confirm dialog before approve | features/entries/CommitteeQueue.tsx (+EntryTable) | Phyllis | todo |
| 4 | Map error.code to Thai messages (ENTRIES_CLOSED, TEAM_EXISTS, ENTRY_* ...) via one `lib/errors.ts` helper; no raw English | lib/errors.ts + callers | Phyllis | todo |
| 5-7 | AdminEntryForm refresh: event context header, two player cards (player+club together), theme tokens instead of bg-blue-500 etc. | AdminEntryForm.tsx | Ryan | todo after #2 |
| 8 | Tournament detail: CTAs and counts instead of underlined links | features/events/TournamentDetailView.tsx | Darryl | todo |
| 9-10 | List filters/search; demote status button; nav user label vs role | TournamentCard/List, SideNav | later | todo |
| 11 | Reject reason min 10 (spec D4) with x/10 counter; API accepts 5 so FE-only | CommitteeQueue.tsx constants | Phyllis | with #3 |
| 12-13 | Demo seed with realistic dates, no QA clutter | BE/QA | Dwight | ask |
| 14-17 | Wizard placeholder, ghost buttons, skeletons, ErrorBanner with retry | various | later | todo |

## Second pass (Pam, docs/design/review-slice-2nd-pass.md)

| Item | What | Owner | Status |
|---|---|---|---|
| N1 | Stale session shows half-logged-in shell | Andy | DONE (AuthedShell logs out and goes to /login) |
| N2 | PlayerPicker: show grade/club count, exclude already-picked player | Ryan | todo |
| N3 | User search misses surnames | Kevin (BE) | ask |
| N4 | Multi-club warning must name the player and clubs | FE after BE gives details | todo |
| N5 | Committee queue grade cell: visible label/range text next to the ladder | Phyllis | todo |
