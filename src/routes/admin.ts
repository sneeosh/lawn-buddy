import { Hono, type Context } from 'hono';
import type { AppContext } from '../types';

const admin = new Hono<AppContext>();

// Auth lives in Cloudflare Access (zero-trust app at the edge). If a request
// reaches this Worker without the Cf-Access-Authenticated-User-Email header,
// Access isn't in front of the route — fail closed rather than serve data.
admin.use('*', async (c, next) => {
  const email = c.req.header('Cf-Access-Authenticated-User-Email');
  if (!email) return c.json({ error: 'access required' }, 403);
  c.set('userEmail', email.toLowerCase());
  await next();
});

type CountRow = { n: number };

async function count(c: Context<AppContext>, sql: string): Promise<number> {
  const row = await c.env.DB.prepare(sql).first<CountRow>();
  return row?.n ?? 0;
}

// GET /api/admin/stats — totals + per-email signup list
admin.get('/stats', async (c) => {
  const [users, lawns, photos, messages, userMessages, assistantMessages, notifications] =
    await Promise.all([
      count(c, 'SELECT COUNT(*) AS n FROM users'),
      count(c, 'SELECT COUNT(*) AS n FROM lawns'),
      count(c, 'SELECT COUNT(*) AS n FROM photos'),
      count(c, 'SELECT COUNT(*) AS n FROM messages'),
      count(c, "SELECT COUNT(*) AS n FROM messages WHERE role = 'user'"),
      count(c, "SELECT COUNT(*) AS n FROM messages WHERE role = 'assistant'"),
      count(c, 'SELECT COUNT(*) AS n FROM notifications'),
    ]);

  const usersList = await c.env.DB.prepare(
    `SELECT u.email,
            u.created_at,
            (SELECT COUNT(*) FROM lawns l WHERE l.user_email = u.email) AS lawn_count,
            (SELECT COUNT(*) FROM messages m
               JOIN lawns l ON l.id = m.lawn_id
              WHERE l.user_email = u.email AND m.role = 'user') AS message_count,
            (SELECT COUNT(*) FROM photos p
               JOIN lawns l ON l.id = p.lawn_id
              WHERE l.user_email = u.email) AS photo_count,
            (SELECT MAX(m.created_at) FROM messages m
               JOIN lawns l ON l.id = m.lawn_id
              WHERE l.user_email = u.email) AS last_message_at
       FROM users u
      ORDER BY u.created_at DESC`
  ).all<{
    email: string;
    created_at: number;
    lawn_count: number;
    message_count: number;
    photo_count: number;
    last_message_at: number | null;
  }>();

  return c.json({
    totals: {
      users,
      lawns,
      photos,
      messages,
      user_messages: userMessages,
      assistant_messages: assistantMessages,
      notifications,
    },
    users: usersList.results ?? [],
  });
});

export default admin;
