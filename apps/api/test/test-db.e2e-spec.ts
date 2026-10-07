import { PrismaClient } from '@prisma/client';
import { testDatabaseUrl } from './test-db';

describe('testDatabaseUrl', () => {
  it('appends _test to database name when TEST_DATABASE_URL is not set', () => {
    const result = testDatabaseUrl({
      DATABASE_URL: 'postgresql://u:p@h:5442/blulens?schema=public',
    });
    expect(result).toBe('postgresql://u:p@h:5442/blulens_test?schema=public');
  });

  it('preserves user, host, port, and query when computing test URL', () => {
    const result = testDatabaseUrl({
      DATABASE_URL: 'postgresql://myuser:mypass@localhost:5433/mydb?schema=custom&sslmode=require',
    });
    expect(result).toBe('postgresql://myuser:mypass@localhost:5433/mydb_test?schema=custom&sslmode=require');
  });

  it('uses TEST_DATABASE_URL if explicitly set', () => {
    const result = testDatabaseUrl({
      DATABASE_URL: 'postgresql://u:p@h:5442/blulens?schema=public',
      TEST_DATABASE_URL: 'postgresql://u:p@h:5442/custom_test?schema=public',
    });
    expect(result).toBe('postgresql://u:p@h:5442/custom_test?schema=public');
  });

  it('throws if TEST_DATABASE_URL equals DATABASE_URL', () => {
    const url = 'postgresql://u:p@h:5442/blulens?schema=public';
    expect(() =>
      testDatabaseUrl({
        DATABASE_URL: url,
        TEST_DATABASE_URL: url,
      })
    ).toThrow('must differ from DATABASE_URL');
  });

  it('throws if DATABASE_URL is missing', () => {
    expect(() => testDatabaseUrl({})).toThrow('DATABASE_URL is required');
  });

  it('connects to the test database in e2e context', async () => {
    const prisma = new PrismaClient();
    try {
      const result = await prisma.$queryRaw<[{ current_database: string }]>`SELECT current_database()`;
      const dbName = result[0].current_database;
      expect(dbName).toMatch(/_test$/);
    } finally {
      await prisma.$disconnect();
    }
  });
});
