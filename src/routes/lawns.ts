import { Hono } from 'hono';
import type { AppContext, LawnRow } from '../types';
import { requireUser } from '../middleware/user';
import { newId } from '../lib/id';
import { validateIntake, validateSoilTest, validateClimateZone } from '../lib/validate';
import { generatePlan } from '../lib/plan';
import { rateLimit, LLM_LIMITS } from '../middleware/rate-limit';

const lawns = new Hono<AppContext>();

lawns.use('*', requireUser);

function rowToLawn(r: LawnRow) {
  return {
    id: r.id,
    name: r.name,
    climate_zone: r.climate_zone,
    intake: r.intake_json ? JSON.parse(r.intake_json) : null,
    soil_test: r.soil_test_json ? JSON.parse(r.soil_test_json) : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

lawns.get('/', async (c) => {
  const email = c.get('userEmail');
  const result = await c.env.DB.prepare(
    'SELECT * FROM lawns WHERE user_email = ? ORDER BY created_at DESC'
  )
    .bind(email)
    .all<LawnRow>();
  return c.json({ lawns: (result.results ?? []).map(rowToLawn) });
});

lawns.post('/', rateLimit(LLM_LIMITS), async (c) => {
  const email = c.get('userEmail');
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'invalid JSON body' }, 400);

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return c.json({ error: 'name is required' }, 400);

  const zoneErr = validateClimateZone(body.climate_zone);
  if (zoneErr) return c.json({ error: zoneErr }, 400);

  let intakeJson: string | null = null;
  if (body.intake !== undefined && body.intake !== null) {
    const intake = validateIntake(body.intake);
    if (typeof intake === 'string') return c.json({ error: intake }, 400);
    intakeJson = JSON.stringify(intake);
  }

  let soilJson: string | null = null;
  if (body.soil_test !== undefined && body.soil_test !== null) {
    const soil = validateSoilTest(body.soil_test);
    if (typeof soil === 'string') return c.json({ error: soil }, 400);
    soilJson = JSON.stringify(soil);
  }

  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO lawns (id, user_email, name, climate_zone, intake_json, soil_test_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(id, email, name, body.climate_zone, intakeJson, soilJson)
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM lawns WHERE id = ?')
    .bind(id)
    .first<LawnRow>();

  // Kick off LLM-driven 6-month plan generation in the background. The user
  // gets their lawn back immediately; the upcoming notifications populate the
  // Notifications tab a few seconds later.
  if (row) {
    c.executionCtx.waitUntil(
      generatePlan(c.env, row).catch((err) => {
        console.error('background plan generation failed', err);
      })
    );
  }

  return c.json({ lawn: rowToLawn(row!) }, 201);
});

lawns.get('/:id', async (c) => {
  const email = c.get('userEmail');
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    'SELECT * FROM lawns WHERE id = ? AND user_email = ?'
  )
    .bind(id, email)
    .first<LawnRow>();
  if (!row) return c.json({ error: 'lawn not found' }, 404);
  return c.json({ lawn: rowToLawn(row) });
});

lawns.patch('/:id', async (c) => {
  const email = c.get('userEmail');
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return c.json({ error: 'invalid JSON body' }, 400);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM lawns WHERE id = ? AND user_email = ?'
  )
    .bind(id, email)
    .first<LawnRow>();
  if (!existing) return c.json({ error: 'lawn not found' }, 404);

  const updates: string[] = [];
  const values: unknown[] = [];

  if (typeof body.name === 'string') {
    const n = body.name.trim();
    if (!n) return c.json({ error: 'name cannot be empty' }, 400);
    updates.push('name = ?');
    values.push(n);
  }

  if (body.climate_zone !== undefined) {
    const zoneErr = validateClimateZone(body.climate_zone);
    if (zoneErr) return c.json({ error: zoneErr }, 400);
    updates.push('climate_zone = ?');
    values.push(body.climate_zone);
  }

  if (body.intake !== undefined) {
    if (body.intake === null) {
      updates.push('intake_json = NULL');
    } else {
      const intake = validateIntake(body.intake);
      if (typeof intake === 'string') return c.json({ error: intake }, 400);
      updates.push('intake_json = ?');
      values.push(JSON.stringify(intake));
    }
  }

  if (body.soil_test !== undefined) {
    if (body.soil_test === null) {
      updates.push('soil_test_json = NULL');
    } else {
      const soil = validateSoilTest(body.soil_test);
      if (typeof soil === 'string') return c.json({ error: soil }, 400);
      updates.push('soil_test_json = ?');
      values.push(JSON.stringify(soil));
    }
  }

  if (updates.length === 0) return c.json({ lawn: rowToLawn(existing) });

  updates.push('updated_at = unixepoch()');
  values.push(id);

  await c.env.DB.prepare(`UPDATE lawns SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM lawns WHERE id = ?')
    .bind(id)
    .first<LawnRow>();
  return c.json({ lawn: rowToLawn(row!) });
});

lawns.delete('/:id', async (c) => {
  const email = c.get('userEmail');
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(
    'DELETE FROM lawns WHERE id = ? AND user_email = ?'
  )
    .bind(id, email)
    .run();
  if (result.meta.changes === 0) return c.json({ error: 'lawn not found' }, 404);
  return c.json({ ok: true });
});

export default lawns;
