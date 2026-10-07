/**
 * Compute the test database URL from the environment.
 * Ensures tests never run against the dev database.
 */
export function testDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const dbUrl = env.TEST_DATABASE_URL || env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is required');

  // If TEST_DATABASE_URL is explicitly set, use it as-is (but still validate it differs from dev)
  if (env.TEST_DATABASE_URL) {
    if (env.TEST_DATABASE_URL === env.DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL; refusing to test on dev DB');
    }
    return env.TEST_DATABASE_URL;
  }

  // Replace database name with <name>_test in the DATABASE_URL
  const url = new URL(env.DATABASE_URL!);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  if (pathSegments.length === 0) {
    throw new Error('DATABASE_URL must include a database name in the path');
  }
  const dbName = pathSegments[0]!;
  const testDbName = `${dbName}_test`;
  url.pathname = `/${testDbName}`;

  const testUrl = url.toString();

  // Verify test URL differs from dev URL
  if (testUrl === env.DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL; refusing to test on dev DB');
  }

  return testUrl;
}
