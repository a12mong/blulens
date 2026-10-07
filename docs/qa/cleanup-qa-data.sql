-- ล้างข้อมูลทดสอบ (QA/e2e) ออกจาก DB dev ที่ใช้ร่วมกัน
-- ลบเฉพาะทัวร์นาเมนต์ที่ชื่อเป็นรูปแบบของ test และ "ไม่มี" assessment / draw / match ผูกกับอีเวนต์ (ถ้ามี ให้ข้าม แล้วรายงาน)
-- ไม่แตะ audit_log (append-only), users, teams, seed
-- dry-run : docker exec -i blulens-postgres psql -U blulens -d blulens -v apply=0 < docs/qa/cleanup-qa-data.sql
-- ลบจริง : ... -v apply=1 ...
BEGIN;
CREATE TEMP TABLE qa_t AS
  SELECT t.id FROM tournaments t
  WHERE (t.name LIKE 'QA Tourney %' OR t.name LIKE 'Diag %' OR t.name LIKE 'API Test Tournament %' OR t.name = 'Test Tournament')
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.tournament_id = t.id AND (
          EXISTS (SELECT 1 FROM assessments a WHERE a.event_id = e.id)
       OR EXISTS (SELECT 1 FROM draws d WHERE d.event_id = e.id)
       OR EXISTS (SELECT 1 FROM matches m WHERE m.event_id = e.id)
       OR EXISTS (SELECT 1 FROM groups g WHERE g.event_id = e.id)));
CREATE TEMP TABLE qa_e AS SELECT id FROM events WHERE tournament_id IN (SELECT id FROM qa_t);
SELECT 'skipped (has assessments/draws/matches)' AS what, count(*) FROM tournaments t
  WHERE (t.name LIKE 'QA Tourney %' OR t.name LIKE 'Diag %' OR t.name LIKE 'API Test Tournament %' OR t.name = 'Test Tournament')
    AND t.id NOT IN (SELECT id FROM qa_t)
UNION ALL SELECT 'tournaments to delete', count(*) FROM qa_t
UNION ALL SELECT 'events to delete', count(*) FROM qa_e
UNION ALL SELECT 'entries to delete', count(*) FROM entries WHERE event_id IN (SELECT id FROM qa_e);
DELETE FROM entries     WHERE event_id IN (SELECT id FROM qa_e);   -- entry_players ไหลตาม (CASCADE)
DELETE FROM events      WHERE id IN (SELECT id FROM qa_e);          -- event_umpires ไหลตาม
DELETE FROM tournaments WHERE id IN (SELECT id FROM qa_t);
SELECT (:apply = 1) AS do_commit \gset
\if :do_commit
COMMIT;
\echo COMMITTED
\else
ROLLBACK;
\echo ROLLED BACK (dry-run)
\endif
