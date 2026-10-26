import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
import { detectPhotoType, MAX_PHOTO_BYTES, PHOTO_ID_PATTERN } from '../../lib/photo';

const storeName = 'courtside-journal-images';

export default async function handler(request: Request): Promise<Response> {
  const user = await getUser().catch(() => null);
  if (!user) return Response.json({ error: '请先登录后上传或查看图片' }, { status: 401 });
  const url = new URL(request.url);
  const store = getStore(storeName);
  const id = url.searchParams.get('id');
  const key = id && PHOTO_ID_PATTERN.test(id) ? `users/${encodeURIComponent(user.id)}/${id}` : null;

  if (request.method === 'GET') {
    if (!key) return new Response(null, { status: 400 });
    const entry = await store.getWithMetadata(key, { type: 'arrayBuffer', consistency: 'strong' });
    if (!entry?.data) return new Response(null, { status: 404 });
    const type = (entry.metadata as { type?: string } | null)?.type || 'application/octet-stream';
    return new Response(entry.data, { headers: { 'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  }

  if (request.headers.get('origin') !== url.origin) return Response.json({ error: '请求来源无效' }, { status: 403 });
  if (request.method === 'POST') {
    const declaredSize = Number(request.headers.get('content-length') || 0);
    if (declaredSize > MAX_PHOTO_BYTES) return Response.json({ error: '单张图片不能超过 2 MB' }, { status: 413 });
    const buffer = await request.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > MAX_PHOTO_BYTES) return Response.json({ error: '单张图片不能超过 2 MB' }, { status: 413 });
    const type = detectPhotoType(new Uint8Array(buffer));
    if (!type) return Response.json({ error: '只支持 JPG、PNG 或 WebP 图片' }, { status: 415 });
    const photoId = crypto.randomUUID();
    await store.set(`users/${encodeURIComponent(user.id)}/${photoId}`, buffer, { metadata: { type } });
    return Response.json({ id: photoId });
  }
  if (request.method === 'DELETE') {
    if (!key) return Response.json({ error: '图片编号无效' }, { status: 400 });
    await store.delete(key);
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 405 });
}
