import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppContext, Env } from './types';
import zones from './routes/zones';
import users from './routes/users';
import lawns from './routes/lawns';
import photos from './routes/photos';
import messages from './routes/messages';
import assessment from './routes/assessment';
import notifications from './routes/notifications';
import estimate from './routes/estimate';
import { runDailyCron } from './lib/cron';

const app = new Hono<AppContext>();

app.use('*', cors());

app.get('/api/health', (c) =>
  c.json({ status: 'ok', app: 'Lawn Buddy' })
);

app.route('/api/zones', zones);
app.route('/api/users', users);
app.route('/api/lawns', lawns);
app.route('/api/lawns', photos);
app.route('/api/lawns', messages);
app.route('/api/lawns', assessment);
app.route('/api/lawns', notifications);
app.route('/api/estimate-size', estimate);

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
  console.error('unhandled error:', err);
  return c.json({ error: err.message ?? 'internal error' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runDailyCron(env)
        .then((stats) => console.log('cron stats', stats))
        .catch((err) => console.error('cron failed', err))
    );
  },
} satisfies ExportedHandler<Env>;
