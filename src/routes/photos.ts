import { Hono, type Context } from 'hono';
import type { AppContext, LawnRow, PhotoRow } from '../types';
import { requireUser } from '../middleware/user';
import { newId } from '../lib/id';

const photos = new Hono<AppContext>();

photos.use('*', requireUser);

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per photo
// HEIC/HEIF are intentionally excluded: the vision model can't decode them,
// so accepting them here would silently drop the photo from inference. The
// SPA transcodes everything (including iPhone HEIC) to JPEG before upload.
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function lawnOwnedByUser(c: Context<AppContext>, lawnId: string): Promise<LawnRow | null> {
  return c.env.DB.prepare('SELECT * FROM lawns WHERE id = ? AND user_email = ?')
    .bind(lawnId, c.get('userEmail'))
    .first<LawnRow>();
}

// POST /api/lawns/:lawnId/photos — multipart upload (field "file"), optional "source"
photos.post('/:lawnId/photos', async (c) => {
  const lawnId = c.req.param('lawnId');
  const lawn = await lawnOwnedByUser(c, lawnId);
  if (!lawn) return c.json({ error: 'lawn not found' }, 404);

  const form = await c.req.parseBody().catch(() => null);
  if (!form) return c.json({ error: 'expected multipart/form-data' }, 400);

  const file = form['file'];
  if (!file || typeof file === 'string') return c.json({ error: 'file field is required' }, 400);
  if (file.size === 0) return c.json({ error: 'file is empty' }, 400);
  if (file.size > MAX_BYTES) return c.json({ error: `file exceeds ${MAX_BYTES} bytes` }, 413);

  const contentType = file.type || 'application/octet-stream';
  if (!ALLOWED_TYPES.has(contentType))
    return c.json({ error: `unsupported content type: ${contentType}` }, 415);

  const sourceRaw = form['source'];
  const source = sourceRaw === 'chat' ? 'chat' : 'onboarding';

  const id = newId();
  const r2Key = `lawns/${lawnId}/${id}`;

  await c.env.PHOTOS.put(r2Key, file.stream(), {
    httpMetadata: { contentType },
  });

  await c.env.DB.prepare(
    'INSERT INTO photos (id, lawn_id, r2_key, source) VALUES (?, ?, ?, ?)'
  )
    .bind(id, lawnId, r2Key, source)
    .run();

  const row = await c.env.DB.prepare('SELECT * FROM photos WHERE id = ?')
    .bind(id)
    .first<PhotoRow>();
  return c.json({ photo: row }, 201);
});

// GET /api/lawns/:lawnId/photos — list photos for a lawn (newest first)
photos.get('/:lawnId/photos', async (c) => {
  const lawnId = c.req.param('lawnId');
  const lawn = await lawnOwnedByUser(c, lawnId);
  if (!lawn) return c.json({ error: 'lawn not found' }, 404);

  const result = await c.env.DB.prepare(
    'SELECT * FROM photos WHERE lawn_id = ? ORDER BY taken_at DESC'
  )
    .bind(lawnId)
    .all<PhotoRow>();
  return c.json({ photos: result.results ?? [] });
});

// GET /api/lawns/:lawnId/photos/:photoId/blob — stream photo bytes from R2
photos.get('/:lawnId/photos/:photoId/blob', async (c) => {
  const lawnId = c.req.param('lawnId');
  const photoId = c.req.param('photoId');
  const lawn = await lawnOwnedByUser(c, lawnId);
  if (!lawn) return c.json({ error: 'lawn not found' }, 404);

  const row = await c.env.DB.prepare(
    'SELECT * FROM photos WHERE id = ? AND lawn_id = ?'
  )
    .bind(photoId, lawnId)
    .first<PhotoRow>();
  if (!row) return c.json({ error: 'photo not found' }, 404);

  const obj = await c.env.PHOTOS.get(row.r2_key);
  if (!obj) return c.json({ error: 'photo blob missing' }, 404);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=3600');
  return new Response(obj.body, { headers });
});

// DELETE /api/lawns/:lawnId/photos/:photoId
photos.delete('/:lawnId/photos/:photoId', async (c) => {
  const lawnId = c.req.param('lawnId');
  const photoId = c.req.param('photoId');
  const lawn = await lawnOwnedByUser(c, lawnId);
  if (!lawn) return c.json({ error: 'lawn not found' }, 404);

  const row = await c.env.DB.prepare(
    'SELECT * FROM photos WHERE id = ? AND lawn_id = ?'
  )
    .bind(photoId, lawnId)
    .first<PhotoRow>();
  if (!row) return c.json({ error: 'photo not found' }, 404);

  await c.env.PHOTOS.delete(row.r2_key);
  await c.env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(photoId).run();
  return c.json({ ok: true });
});

export default photos;
