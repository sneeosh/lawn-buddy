import type { Context, Next } from 'hono';
import type { AppContext } from '../types';

export type RateLimit = {
  limit: number;       // max requests per window
  windowSec: number;   // window length in seconds
  label: string;       // short identifier (used in keys + error messages)
  scope?: 'ip+email' | 'ip'; // default 'ip+email'
};

// LLM-bearing endpoints. Two layers:
// - per (ip, email): protects a single account from runaway use.
// - per ip: protects against an attacker rotating emails from one IP.
export const LLM_LIMITS: RateLimit[] = [
  { limit: 10,  windowSec: 60,    label: 'llm-min',    scope: 'ip+email' },
  { limit: 60,  windowSec: 86400, label: 'llm-day',    scope: 'ip+email' },
  { limit: 30,  windowSec: 60,    label: 'llm-ip-min', scope: 'ip' },
  { limit: 200, windowSec: 86400, label: 'llm-ip-day', scope: 'ip' },
];

// Hono middleware: enforces every limit in `limits` against the same request.
// On the first hit that exceeds, returns 429 without consuming the others.
export function rateLimit(limits: RateLimit[]) {
  return async (c: Context<AppContext>, next: Next) => {
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const email = c.get('userEmail') || 'anon';
    const now = Math.floor(Date.now() / 1000);

    for (const { limit, windowSec, label, scope } of limits) {
      const windowStart = Math.floor(now / windowSec) * windowSec;
      const subject = scope === 'ip' ? ip : `${ip}:${email}`;
      const key = `${label}:${subject}`;

      const row = await c.env.DB.prepare(
        'SELECT count FROM rate_limits WHERE key = ? AND window_start = ?'
      )
        .bind(key, windowStart)
        .first<{ count: number }>();

      if ((row?.count ?? 0) >= limit) {
        const retryAfter = windowStart + windowSec - now;
        c.header('Retry-After', String(Math.max(retryAfter, 1)));
        return c.json(
          { error: `rate limit exceeded (${label}: ${limit}/${windowSec}s)` },
          429
        );
      }

      await c.env.DB.prepare(
        `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
         ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1`
      )
        .bind(key, windowStart)
        .run();
    }
    await next();
  };
}
