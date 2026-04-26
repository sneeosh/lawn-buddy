import { Hono } from 'hono';
import type { AppContext } from '../types';
import { requireUser } from '../middleware/user';

const users = new Hono<AppContext>();

users.use('*', requireUser);

users.get('/me', (c) => {
  return c.json({ email: c.get('userEmail') });
});

export default users;
