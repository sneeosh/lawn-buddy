// Background plan generator. Run after a lawn is created (via waitUntil) to ask
// the LLM for a personalized 6-month seasonal plan. Plan items are inserted as
// notifications with scheduled_for set to the target date — the daily cron will
// email them once their date passes.

import type { Env, LawnRow } from '../types';
import { getZone } from './zones';
import { callLlmJson } from './llm';
import { newId } from './id';

type PlanItem = {
  scheduled_for: string; // YYYY-MM-DD
  title: string;
  body: string;
  dedup_key: string;
};

const PLAN_SYSTEM = `You are an expert lawn-care advisor producing a personalized 6-month seasonal care plan for a single lawn.

Return JSON with this exact shape:
{"plan": [{"scheduled_for": "YYYY-MM-DD", "title": "<short headline>", "body": "<2-4 sentences with the recommendation and why it matters>", "dedup_key": "<stable id>"}]}

Rules:
- Produce 4 to 8 entries spanning the next 180 days from today.
- Each entry's scheduled_for must be a real ISO date (YYYY-MM-DD) within that window.
- Tailor advice to the lawn's grass season (warm/cool/transition), climate zone, and stated issues. Avoid generic items that apply to any lawn.
- Cover the time-sensitive moments: pre-emergent windows, fertilization windows, mowing-height transitions, overseeding/aeration timing (if relevant), dormancy prep.
- If the user has no irrigation, do not plan irrigation-system maintenance.
- dedup_key must be stable so a future cron run won't duplicate it. Format: "<topic>-<year>" (e.g. "spring-preemergent-2026", "fall-fertilization-2026").
- Do not include legal/safety disclaimers — the platform appends those automatically.
- Output ONLY the JSON object. No preamble, no Markdown fence, no other text.`;

export async function generatePlan(env: Env, lawn: LawnRow, now: Date = new Date()): Promise<number> {
  const zone = getZone(lawn.climate_zone);
  if (!zone) return 0;

  const intake = lawn.intake_json ? JSON.parse(lawn.intake_json) : null;
  const soil = lawn.soil_test_json ? JSON.parse(lawn.soil_test_json) : null;

  const today = now.toISOString().slice(0, 10);
  const windowEnd = new Date(now.getTime() + 180 * 86400 * 1000).toISOString().slice(0, 10);

  const userText = [
    `Today: ${today}`,
    `Plan window: ${today} to ${windowEnd}`,
    '',
    `Lawn: ${lawn.name}`,
    `Climate: ${zone.state} / ${zone.region} (USDA ${zone.usdaZone}, ${zone.grassSeason}-season region)`,
    intake ? `Intake: ${JSON.stringify(intake)}` : 'Intake: (not provided)',
    soil && Object.keys(soil).length ? `Soil test: ${JSON.stringify(soil)}` : 'Soil test: (not provided)',
  ].join('\n');

  let result: { plan?: PlanItem[] };
  try {
    result = await callLlmJson<{ plan: PlanItem[] }>(env, PLAN_SYSTEM, userText, 2048);
  } catch (err) {
    console.error('plan generation failed for lawn', lawn.id, err);
    return 0;
  }

  const items = Array.isArray(result.plan) ? result.plan : [];
  if (items.length === 0) return 0;

  const minTs = Math.floor(now.getTime() / 1000);
  const maxTs = minTs + 180 * 86400 + 86400; // small slop

  let inserted = 0;
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    if (!item.title || !item.body || !item.dedup_key || !item.scheduled_for) continue;

    const date = parseIsoDate(item.scheduled_for);
    if (!date) continue;
    const ts = Math.floor(date.getTime() / 1000);
    if (ts < minTs || ts > maxTs) continue;

    const type = /frost|heat|rain|storm|snow|temp/i.test(item.dedup_key) ? 'weather' : 'seasonal';

    const existing = await env.DB.prepare(
      'SELECT 1 FROM notifications WHERE lawn_id = ? AND dedup_key = ? LIMIT 1'
    )
      .bind(lawn.id, item.dedup_key)
      .first<{ 1: number }>();
    if (existing) continue;

    await env.DB.prepare(
      `INSERT INTO notifications (id, lawn_id, type, title, body, dedup_key, scheduled_for)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(newId(), lawn.id, type, item.title, item.body, item.dedup_key, ts)
      .run();
    inserted++;
  }

  return inserted;
}

function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  // Treat as UTC midnight so timezone drift doesn't shift the bucket.
  const d = new Date(`${s}T12:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}
