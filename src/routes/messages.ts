import { Hono, type Context } from 'hono';
import type { AppContext, LawnRow, MessageRow, PhotoRow } from '../types';
import { requireUser } from '../middleware/user';
import { rateLimit, LLM_LIMITS } from '../middleware/rate-limit';
import { newId } from '../lib/id';
import {
  buildSystemPrompt,
  callLlm,
  maybeAppendDisclaimer,
  rowToChatMessage,
  type ChatMessage,
} from '../lib/llm';

const messages = new Hono<AppContext>();

messages.use('*', requireUser);

const HISTORY_DAYS = 90;
const MAX_HISTORY_TURNS = 30; // recent N msgs included in LLM context

async function lawnOwnedByUser(c: Context<AppContext>, lawnId: string): Promise<LawnRow | null> {
  return c.env.DB.prepare('SELECT * FROM lawns WHERE id = ? AND user_email = ?')
    .bind(lawnId, c.get('userEmail'))
    .first<LawnRow>();
}

async function loadPhotoKeys(c: Context<AppContext>, lawnId: string): Promise<Map<string, string>> {
  const result = await c.env.DB.prepare('SELECT id, r2_key FROM photos WHERE lawn_id = ?')
    .bind(lawnId)
    .all<{ id: string; r2_key: string }>();
  const map = new Map<string, string>();
  for (const r of result.results ?? []) map.set(r.id, r.r2_key);
  return map;
}

// GET /api/lawns/:lawnId/messages — list messages within the rolling 90-day window
messages.get('/:lawnId/messages', async (c) => {
  const lawnId = c.req.param('lawnId');
  const lawn = await lawnOwnedByUser(c, lawnId);
  if (!lawn) return c.json({ error: 'lawn not found' }, 404);

  const cutoff = Math.floor(Date.now() / 1000) - HISTORY_DAYS * 86400;
  const result = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE lawn_id = ? AND created_at >= ? ORDER BY created_at ASC'
  )
    .bind(lawnId, cutoff)
    .all<MessageRow>();

  const rows = result.results ?? [];
  return c.json({
    messages: rows.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      photo_ids: r.photo_ids_json ? JSON.parse(r.photo_ids_json) : [],
      created_at: r.created_at,
    })),
  });
});

// POST /api/lawns/:lawnId/messages
// Body: { content: string, photo_ids?: string[] }
// Appends user msg, calls LLM, persists assistant reply, returns both.
messages.post('/:lawnId/messages', rateLimit(LLM_LIMITS), async (c) => {
  const lawnId = c.req.param('lawnId') as string;
  const lawn = await lawnOwnedByUser(c, lawnId);
  if (!lawn) return c.json({ error: 'lawn not found' }, 404);

  const body = (await c.req.json().catch(() => null)) as
    | { content?: unknown; photo_ids?: unknown }
    | null;
  if (!body) return c.json({ error: 'invalid JSON body' }, 400);

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const photoIds = Array.isArray(body.photo_ids)
    ? body.photo_ids.filter((p): p is string => typeof p === 'string')
    : [];

  if (!content && photoIds.length === 0)
    return c.json({ error: 'content or photo_ids is required' }, 400);

  // Validate photo ownership
  if (photoIds.length > 0) {
    const placeholders = photoIds.map(() => '?').join(',');
    const ownedRes = await c.env.DB.prepare(
      `SELECT id FROM photos WHERE lawn_id = ? AND id IN (${placeholders})`
    )
      .bind(lawnId, ...photoIds)
      .all<{ id: string }>();
    if ((ownedRes.results?.length ?? 0) !== photoIds.length)
      return c.json({ error: 'one or more photo_ids do not belong to this lawn' }, 400);
  }

  // Persist user message
  const userMsgId = newId();
  await c.env.DB.prepare(
    'INSERT INTO messages (id, lawn_id, role, content, photo_ids_json) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(
      userMsgId,
      lawnId,
      'user',
      content,
      photoIds.length ? JSON.stringify(photoIds) : null
    )
    .run();

  // Build LLM context: last N messages within history window
  const cutoff = Math.floor(Date.now() / 1000) - HISTORY_DAYS * 86400;
  const historyRes = await c.env.DB.prepare(
    `SELECT * FROM messages
     WHERE lawn_id = ? AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT ?`
  )
    .bind(lawnId, cutoff, MAX_HISTORY_TURNS)
    .all<MessageRow>();
  const historyAsc = (historyRes.results ?? []).slice().reverse();

  const photoKeys = await loadPhotoKeys(c, lawnId);
  const llmMessages: ChatMessage[] = [];
  for (const r of historyAsc) {
    llmMessages.push(await rowToChatMessage(c.env, r, photoKeys));
  }

  // Call LLM
  const system = buildSystemPrompt(lawn);
  let assistantContent: string;
  try {
    const result = await callLlm(c.env, system, llmMessages);
    assistantContent = maybeAppendDisclaimer(result.content);
  } catch (err) {
    // Roll back the user message so the user can retry cleanly
    await c.env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(userMsgId).run();
    const msg = err instanceof Error ? err.message : 'LLM call failed';
    return c.json({ error: msg }, 502);
  }

  const assistantMsgId = newId();
  await c.env.DB.prepare(
    'INSERT INTO messages (id, lawn_id, role, content, photo_ids_json) VALUES (?, ?, ?, ?, NULL)'
  )
    .bind(assistantMsgId, lawnId, 'assistant', assistantContent)
    .run();

  const userRow = await c.env.DB.prepare('SELECT * FROM messages WHERE id = ?')
    .bind(userMsgId)
    .first<MessageRow>();
  const assistantRow = await c.env.DB.prepare('SELECT * FROM messages WHERE id = ?')
    .bind(assistantMsgId)
    .first<MessageRow>();

  return c.json({
    user_message: {
      id: userRow!.id,
      role: 'user',
      content: userRow!.content,
      photo_ids: userRow!.photo_ids_json ? JSON.parse(userRow!.photo_ids_json) : [],
      created_at: userRow!.created_at,
    },
    assistant_message: {
      id: assistantRow!.id,
      role: 'assistant',
      content: assistantRow!.content,
      photo_ids: [] as string[],
      created_at: assistantRow!.created_at,
    },
  });
});

export default messages;
