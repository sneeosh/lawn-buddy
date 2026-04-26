import { Hono, type Context } from 'hono';
import type { AppContext, LawnRow, NotificationRow } from '../types';
import { requireUser } from '../middleware/user';

const notifications = new Hono<AppContext>();

notifications.use('*', requireUser);

async function lawnOwnedByUser(c: Context<AppContext>, lawnId: string): Promise<LawnRow | null> {
  return c.env.DB.prepare('SELECT * FROM lawns WHERE id = ? AND user_email = ?')
    .bind(lawnId, c.get('userEmail'))
    .first<LawnRow>();
}

// GET /api/lawns/:lawnId/notifications — split into upcoming (scheduled for the
// future) and recent (already due / sent immediately).
notifications.get('/:lawnId/notifications', async (c) => {
  const lawnId = c.req.param('lawnId');
  const lawn = await lawnOwnedByUser(c, lawnId);
  if (!lawn) return c.json({ error: 'lawn not found' }, 404);

  const now = Math.floor(Date.now() / 1000);

  const upcomingRes = await c.env.DB.prepare(
    `SELECT * FROM notifications
     WHERE lawn_id = ? AND scheduled_for IS NOT NULL AND scheduled_for > ?
     ORDER BY scheduled_for ASC LIMIT 50`
  )
    .bind(lawnId, now)
    .all<NotificationRow>();

  const recentRes = await c.env.DB.prepare(
    `SELECT * FROM notifications
     WHERE lawn_id = ? AND (scheduled_for IS NULL OR scheduled_for <= ?)
     ORDER BY sent_at DESC LIMIT 100`
  )
    .bind(lawnId, now)
    .all<NotificationRow>();

  return c.json({
    upcoming: upcomingRes.results ?? [],
    recent: recentRes.results ?? [],
    // Legacy field for any cached client code: equivalent to "recent".
    notifications: recentRes.results ?? [],
  });
});

// POST /api/lawns/:lawnId/notifications/:id/read
notifications.post('/:lawnId/notifications/:id/read', async (c) => {
  const lawnId = c.req.param('lawnId');
  const id = c.req.param('id');
  const lawn = await lawnOwnedByUser(c, lawnId);
  if (!lawn) return c.json({ error: 'lawn not found' }, 404);

  const result = await c.env.DB.prepare(
    'UPDATE notifications SET read_at = unixepoch() WHERE id = ? AND lawn_id = ? AND read_at IS NULL'
  )
    .bind(id, lawnId)
    .run();
  if (result.meta.changes === 0) return c.json({ error: 'notification not found or already read' }, 404);
  return c.json({ ok: true });
});

export default notifications;
