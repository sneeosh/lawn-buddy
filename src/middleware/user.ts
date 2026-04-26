import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

// v1 auth: X-User-Email + X-Device-Id headers.
// First request from an email claims it for the device; later requests with the same
// email but a different device id are rejected with 409. Email-only re-use across
// browsers is intentionally blocked to avoid silent account sharing.
export const requireUser: MiddlewareHandler<AppContext> = async (c, next) => {
  const rawEmail = c.req.header('X-User-Email') ?? '';
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email))
    return c.json({ error: 'missing or invalid X-User-Email header' }, 401);

  const deviceId = c.req.header('X-Device-Id') ?? '';
  if (!DEVICE_ID_RE.test(deviceId))
    return c.json({ error: 'missing or invalid X-Device-Id header' }, 401);

  // Try to claim the row for this device. If it already exists with a different
  // device id, this is a no-op and we'll detect the mismatch below.
  await c.env.DB.prepare(
    'INSERT INTO users (email, device_id) VALUES (?, ?) ON CONFLICT(email) DO NOTHING'
  )
    .bind(email, deviceId)
    .run();

  const existing = await c.env.DB.prepare(
    'SELECT email, device_id FROM users WHERE email = ?'
  )
    .bind(email)
    .first<{ email: string; device_id: string | null }>();

  if (!existing) {
    // Shouldn't happen — INSERT above guarantees the row.
    return c.json({ error: 'failed to load user' }, 500);
  }

  if (existing.device_id === null) {
    // Legacy row created before device_id column existed; backfill it.
    await c.env.DB.prepare('UPDATE users SET device_id = ? WHERE email = ?')
      .bind(deviceId, email)
      .run();
  } else if (existing.device_id !== deviceId) {
    return c.json({ error: 'this email is already in use on another device' }, 409);
  }

  c.set('userEmail', email);
  await next();
};
