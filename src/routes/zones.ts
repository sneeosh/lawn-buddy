import { Hono } from 'hono';
import type { AppContext } from '../types';
import { zonesByState } from '../lib/zones';

const zones = new Hono<AppContext>();

zones.get('/', (c) => c.json({ states: zonesByState() }));

export default zones;
