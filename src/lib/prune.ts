import type { Env } from '../types';

const HISTORY_DAYS = 90;

// Drops messages older than the rolling 90-day window. Photos in R2 are unaffected.
export async function pruneOldMessages(env: Env): Promise<number> {
  const cutoff = Math.floor(Date.now() / 1000) - HISTORY_DAYS * 86400;
  const result = await env.DB.prepare('DELETE FROM messages WHERE created_at < ?')
    .bind(cutoff)
    .run();
  return result.meta.changes ?? 0;
}
