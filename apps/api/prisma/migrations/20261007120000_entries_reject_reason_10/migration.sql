-- Entry reject reason >= 10 chars after trim (openapi EntryRejectInput, decision 2026-10-07).
-- NOT VALID: existing rejected rows (5..9 chars, valid under the old rule) are kept; new and updated rows are checked.
ALTER TABLE "entries" DROP CONSTRAINT "entries_reject_reason_chk";
ALTER TABLE "entries" ADD CONSTRAINT "entries_reject_reason_chk" CHECK (
  "status" <> 'rejected' OR char_length(btrim(coalesce("decision_reason", ''))) >= 10
) NOT VALID;
