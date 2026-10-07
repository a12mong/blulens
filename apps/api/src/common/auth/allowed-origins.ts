/**
 * Parse and validate allowed origins from environment.
 * No Nest imports — pure functions for testability.
 */

export function allowedOrigins(env: NodeJS.ProcessEnv | Record<string, string | undefined>): string[] {
  const webUrls = env.WEB_URLS?.trim();
  if (webUrls) {
    return webUrls
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .map((url) => new URL(url).origin); // Throws on invalid URL — fail at boot
  }

  const webUrl = env.WEB_URL ?? 'http://localhost:3100';
  return [new URL(webUrl).origin];
}

export function isAllowedOrigin(origin: string, allowed: string[], nodeEnv: string | undefined): boolean {
  if (allowed.includes(origin)) return true;

  if (nodeEnv === 'development') {
    try {
      const url = new URL(origin);
      if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
        return true;
      }
    } catch {
      // Invalid URL, fall through
    }
  }

  return false;
}
