import { Hono, type Context } from 'hono';
import type { AppContext, LawnRow, MessageRow, PhotoRow } from '../types';
import { requireUser } from '../middleware/user';
import { rateLimit, LLM_LIMITS } from '../middleware/rate-limit';
import { newId } from '../lib/id';
import {
  buildSystemPrompt,
  buildImageBlock,
  callLlm,
  maybeAppendDisclaimer,
  type ChatMessage,
} from '../lib/llm';

const assessment = new Hono<AppContext>();

assessment.use('*', requireUser);

function buildAssessmentPrompt(photoCount: number): string {
  const photoLine = photoCount > 0
    ? `Reference what you see in the ${photoCount === 1 ? 'attached photo' : 'attached photos'}.`
    : 'No photos were provided. Base your assessment on the profile only and note that visual confirmation would refine the recommendation.';
  const speciesGuidance = photoCount > 0
    ? 'what you see and your confidence level'
    : 'best guess from the climate zone and intake — flag low confidence';

  return `Please give an initial assessment of this lawn. Use the profile in the system prompt${photoCount > 0 ? ' and the attached photos' : ''}.

Format your response with these sections:
1. **Likely grass species** — ${speciesGuidance}.
2. **Seed vs sod** — recommendation if the lawn needs renovation, or "no renovation needed" if not.
3. **Condition baseline** — overall health, any visible issues.
4. **Top 3 next actions** — concrete, time-sensitive steps for the current month and climate zone.

Be specific. ${photoLine}`;
}

function buildReassessPrompt(note: string): string {
  return `My lawn details have been updated. ${note ? `Changes: ${note}` : 'I want a refreshed assessment.'}

Use the updated profile in the system prompt to give a refreshed take. Format your response with these sections:
1. **What changes for me** — given the updated details, what shifts in your recommendation? Reference the specific changes by name.
2. **Updated condition read** — based on the new profile.
3. **Top 3 next actions** — concrete, time-sensitive steps for the current month and climate zone.

Be specific and concrete. If a change does not affect the plan, say so.`;
}

async function lawnOwnedByUser(c: Context<AppContext>, lawnId: string): Promise<LawnRow | null> {
  return c.env.DB.prepare('SELECT * FROM lawns WHERE id = ? AND user_email = ?')
    .bind(lawnId, c.get('userEmail'))
    .first<LawnRow>();
}

// POST /api/lawns/:lawnId/assessment
// First call: generates the seed assistant message from intake + onboarding photos.
// Subsequent calls: re-assessment after intake edits. Optional body { note?: string }
// describes what changed; the response is appended to the chat thread.
assessment.post('/:lawnId/assessment', rateLimit(LLM_LIMITS), async (c) => {
  const lawnId = c.req.param('lawnId') as string;
  const lawn = await lawnOwnedByUser(c, lawnId);
  if (!lawn) return c.json({ error: 'lawn not found' }, 404);

  if (!lawn.intake_json)
    return c.json({ error: 'lawn intake must be completed before assessment' }, 400);

  const body = (await c.req.json().catch(() => ({}))) as { note?: string };
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';

  const existing = await c.env.DB.prepare(
    'SELECT id FROM messages WHERE lawn_id = ? LIMIT 1'
  )
    .bind(lawnId)
    .first<{ id: string }>();
  const isReassess = !!existing;

  // Need photo count for the initial-assessment branch; load before building prompt.
  let onboardingPhotos: PhotoRow[] = [];
  if (!isReassess) {
    const photoRes = await c.env.DB.prepare(
      "SELECT * FROM photos WHERE lawn_id = ? AND source = 'onboarding' ORDER BY taken_at ASC"
    )
      .bind(lawnId)
      .all<PhotoRow>();
    onboardingPhotos = photoRes.results ?? [];
  }

  const promptText = isReassess
    ? buildReassessPrompt(note)
    : buildAssessmentPrompt(onboardingPhotos.length);

  // Initial assessment includes onboarding photos so the LLM can read them.
  // Re-assessments are text-only — the user's already in a chat thread and can
  // attach photos via chat for visual follow-ups.
  const content: ChatMessage['content'] = [];
  for (const p of onboardingPhotos) {
    const block = await buildImageBlock(c.env, p.r2_key);
    if (block) (content as any[]).push(block);
  }
  (content as any[]).push({ type: 'text', text: promptText });

  const userMsg: ChatMessage = { role: 'user', content };
  const system = buildSystemPrompt(lawn);

  const userMsgId = newId();
  await c.env.DB.prepare(
    'INSERT INTO messages (id, lawn_id, role, content, photo_ids_json) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(
      userMsgId,
      lawnId,
      'user',
      promptText,
      onboardingPhotos.length ? JSON.stringify(onboardingPhotos.map((p) => p.id)) : null
    )
    .run();

  let assistantContent: string;
  try {
    const result = await callLlm(c.env, system, [userMsg]);
    assistantContent = maybeAppendDisclaimer(result.content);
  } catch (err) {
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
  }, 201);
});

export default assessment;
