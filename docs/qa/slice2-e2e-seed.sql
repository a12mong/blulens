-- Slice 2 e2e seed (Dwight). Run ONLY on DB blulens_e2e. Idempotent.
-- Creates reviewer1..3@blulens.local (Reviewer, no team) using the same demo password hash as member1.
-- Obsolete once the demo seed (card for reviewer1..3) lands on develop and is applied to blulens_e2e.
INSERT INTO users (id, email, password_hash, display_name, status, created_at, updated_at)
SELECT gen_random_uuid(), 'reviewer' || n || '@blulens.local', m.password_hash, 'Reviewer ' || n || ' (e2e)', 'active', now(), now()
FROM generate_series(1,3) n, users m
WHERE m.email = 'member1@blulens.local'
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role, created_at)
SELECT id, 'Reviewer', now() FROM users WHERE email IN ('reviewer1@blulens.local','reviewer2@blulens.local','reviewer3@blulens.local')
ON CONFLICT DO NOTHING;
