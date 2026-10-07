-- รันครั้งแรกที่ volume ว่าง (docker-entrypoint-initdb.d)
-- role ของแอปแบบไม่ใช่ superuser; CREATEDB สำหรับ shadow database ของ prisma migrate dev
CREATE ROLE blulens_app LOGIN PASSWORD 'blulens_app' NOSUPERUSER CREATEDB;
GRANT ALL ON DATABASE blulens TO blulens_app;
GRANT ALL ON SCHEMA public TO blulens_app;
