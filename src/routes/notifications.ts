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

// GET /api/lawns/:lawnId/notifications — newest first
notifications.get('/:lawnId/notifications', async (c) => {
  const lawnId = c.req.param('lawnId');
  const lawn = await lawnOwnedByUser(c, lawnId);
  if (!lawn) return c.json({ error: 'lawn not found' }, 404);

  const result = await c.env.DB.prepare(
    'SELECT * FROM notifications WHERE lawn_id = ? ORDER BY sent_at DESC LIMIT 100'
  )
    .bind(lawnId)
    .all<NotificationRow>();
  return c.json({ notifications: result.results ?? [] });
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
