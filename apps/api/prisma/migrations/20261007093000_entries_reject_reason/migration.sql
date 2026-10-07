-- Align the reject reason with the contract (openapi ReasonInput: >= 5 chars after trim).
ALTER TABLE "entries" DROP CONSTRAINT "entries_reject_reason_chk";
ALTER TABLE "entries" ADD CONSTRAINT "entries_reject_reason_chk" CHECK (
  "status" <> 'rejected' OR char_length(btrim(coalesce("decision_reason", ''))) >= 5
);
