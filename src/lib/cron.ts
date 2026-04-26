// Daily cron: walk every lawn, ask the LLM what alerts (if any) apply given the
// lawn profile + climate zone + 7-day weather forecast. Persist new ones, email,
// and prune old chat history. Dedup'd via the `dedup_key` column on notifications.

import type { Env, LawnRow } from '../types';
import { getZone } from './zones';
import { fetchWeatherForecast, summarizeForecast } from './weather';
import { callLlmJson } from './llm';
import { sendEmail } from './email';
import { newId } from './id';
import { pruneOldMessages } from './prune';

type LlmAlert = {
  title: string;
  body: string;
  dedup_key: string;
};

const ALERT_SYSTEM = `You are an expert lawn-care advisor. Given a lawn's profile, its climate zone, today's date, and a 7-day weather forecast, decide whether there is anything time-sensitive the homeowner should know in the next 1-14 days.

Return JSON with this exact shape:
{"alerts": [{"title": "<short headline>", "body": "<2-4 sentences with the recommendation and rationale>", "dedup_key": "<stable id>"}]}

Rules:
- Be selective. Most days produce zero alerts. Only flag items that are time-sensitive (seasonal-window applications, weather-driven actions, dormancy transitions). Do not generate generic care reminders.
- "dedup_key" must be stable so the same alert doesn't fire on consecutive days. Use the format "<topic>-<year>" (e.g. "spring-preemergent-2026", "frost-warning-2026-04-12") or "<topic>-<year>-<week>" for sub-weekly events.
- Reference the user's actual climate zone, grass season, and the forecast in the body. Don't be generic.
- If chemicals/pesticides/fertilizer are recommended, mention safety considerations briefly in the body.
- Output ONLY the JSON object. No preamble, no Markdown fence, no other text.`;

export async function runDailyCron(env: Env, now: Date = new Date()): Promise<{
  lawnsProcessed: number;
  notificationsCreated: number;
  emailsSent: number;
  messagesPruned: number;
  errors: number;
}> {
  const lawnsRes = await env.DB.prepare('SELECT * FROM lawns').all<LawnRow>();
  const lawns = lawnsRes.results ?? [];

  let notificationsCreated = 0;
  let emailsSent = 0;
  let errors = 0;

  for (const lawn of lawns) {
    try {
      const zone = getZone(lawn.climate_zone);
      if (!zone) continue;

      const forecast = await fetchWeatherForecast(zone);
      if (!forecast) {
        errors++;
        continue;
      }

      const intake = lawn.intake_json ? JSON.parse(lawn.intake_json) : null;
      const soil = lawn.soil_test_json ? JSON.parse(lawn.soil_test_json) : null;

      const userText = [
        `Today: ${now.toISOString().slice(0, 10)}`,
        '',
        `Lawn: ${lawn.name}`,
        `Climate: ${zone.state} / ${zone.region} (USDA ${zone.usdaZone}, ${zone.grassSeason}-season region)`,
        intake ? `Intake: ${JSON.stringify(intake)}` : 'Intake: (not provided)',
        soil && Object.keys(soil).length ? `Soil test: ${JSON.stringify(soil)}` : 'Soil test: (not provided)',
        '',
        'Weather:',
        summarizeForecast(forecast),
      ].join('\n');

      const result = await callLlmJson<{ alerts: LlmAlert[] }>(
        env,
        ALERT_SYSTEM,
        userText,
        2048
      );
      const alerts = Array.isArray(result.alerts) ? result.alerts : [];
      if (alerts.length === 0) continue;

      // Dedup against existing notifications
      const dedupKeys = alerts.map((a) => a.dedup_key);
      const placeholders = dedupKeys.map(() => '?').join(',');
      const existingRes = await env.DB.prepare(
        `SELECT dedup_key FROM notifications WHERE lawn_id = ? AND dedup_key IN (${placeholders})`
      )
        .bind(lawn.id, ...dedupKeys)
        .all<{ dedup_key: string }>();
      const sentKeys = new Set((existingRes.results ?? []).map((r) => r.dedup_key));
      const fresh = alerts.filter((a) => a.title && a.body && a.dedup_key && !sentKeys.has(a.dedup_key));
      if (fresh.length === 0) continue;

      // Classify each alert. Anything weather-related is tagged 'weather', else 'seasonal'.
      // (The LLM doesn't tag explicitly; we infer from dedup_key for now.)
      for (const a of fresh) {
        const type = /frost|heat|rain|storm|snow|temp/i.test(a.dedup_key) ? 'weather' : 'seasonal';
        await env.DB.prepare(
          'INSERT INTO notifications (id, lawn_id, type, title, body, dedup_key) VALUES (?, ?, ?, ?, ?, ?)'
        )
          .bind(newId(), lawn.id, type, a.title, a.body, a.dedup_key)
          .run();
        notificationsCreated++;
      }

      const subject =
        fresh.length === 1
          ? `Lawn Buddy: ${fresh[0]!.title}`
          : `Lawn Buddy: ${fresh.length} updates for ${lawn.name}`;
      const text = fresh.map((n) => `▸ ${n.title}\n${n.body}`).join('\n\n');

      try {
        await sendEmail(env, { to: lawn.user_email, subject, text });
        emailsSent++;
      } catch (err) {
        console.error('email send failed for lawn', lawn.id, err);
        errors++;
      }
    } catch (err) {
      console.error('cron failed for lawn', lawn.id, err);
      errors++;
    }
  }

  const messagesPruned = await pruneOldMessages(env);

  return {
    lawnsProcessed: lawns.length,
    notificationsCreated,
    emailsSent,
    messagesPruned,
    errors,
  };
}
