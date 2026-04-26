import { Hono } from 'hono';
import type { AppContext } from '../types';
import { requireUser } from '../middleware/user';
import {
  callLlm,
  imageBlockFromBuffer,
  stripJsonFence,
  type ChatMessage,
} from '../lib/llm';

const estimate = new Hono<AppContext>();

estimate.use('*', requireUser);

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PHOTOS = 6;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const SYSTEM_PROMPT = `You estimate residential lawn size from photos. Photos may include reference objects (people, cars, houses, fences, trees) you can scale against.

Return JSON only, with this shape:
{"size_sqft": <integer>, "confidence": "low" | "medium" | "high", "reasoning": "<one short sentence>"}

Be honest about confidence:
- "high" only when reference objects clearly anchor the scale.
- "medium" when the framing gives reasonable cues.
- "low" when photos are tight crops without reference objects — in that case still give your best ballpark, but say so.

A typical American front yard is 1,500–4,000 sq ft. A typical full residential lot is 5,000–10,000 sq ft. Output ONLY the JSON object.`;

// POST /api/estimate-size
// Multipart with one or more `file` fields. Returns { size_sqft, confidence, reasoning }.
estimate.post('/', async (c) => {
  const form = await c.req.parseBody({ all: true }).catch(() => null);
  if (!form) return c.json({ error: 'expected multipart/form-data' }, 400);

  const filesRaw = form['file'];
  const files: { size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer> }[] = [];
  const candidates = Array.isArray(filesRaw) ? filesRaw : filesRaw ? [filesRaw] : [];
  for (const f of candidates) {
    if (typeof f === 'string') continue;
    files.push(f);
  }
  if (files.length === 0) return c.json({ error: 'at least one file is required' }, 400);
  if (files.length > MAX_PHOTOS) return c.json({ error: `up to ${MAX_PHOTOS} files` }, 400);

  const blocks: ChatMessage['content'] = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) return c.json({ error: 'one or more files exceed the size limit' }, 413);
    if (!ALLOWED_TYPES.has(f.type))
      return c.json({ error: `unsupported content type: ${f.type}` }, 415);
    const buf = await f.arrayBuffer();
    (blocks as any[]).push(imageBlockFromBuffer(buf, f.type));
  }
  (blocks as any[]).push({
    type: 'text',
    text: 'Estimate the total lawn area in square feet from these photos.',
  });

  let parsed: { size_sqft: number; confidence: string; reasoning: string };
  try {
    const res = await callLlm(c.env, SYSTEM_PROMPT, [{ role: 'user', content: blocks }], 512);
    const cleaned = stripJsonFence(res.content);
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'estimate failed';
    return c.json({ error: msg }, 502);
  }

  if (typeof parsed?.size_sqft !== 'number' || !Number.isFinite(parsed.size_sqft) || parsed.size_sqft <= 0)
    return c.json({ error: 'estimator returned an invalid size' }, 502);

  return c.json({
    size_sqft: Math.round(parsed.size_sqft),
    confidence: parsed.confidence ?? 'low',
    reasoning: parsed.reasoning ?? '',
  });
});

export default estimate;
