import { getUser } from '@netlify/identity';
import { MOODS, type WatchedGame } from '../../lib/journal';
import { loadJournal, updateJournal } from '../lib/journal-store';
import { MAX_PHOTOS_PER_GAME, PHOTO_ID_PATTERN } from '../../lib/photo';

export default async function handler(request: Request): Promise<Response> {
  let user;
  try { user = await getUser(); }
  catch (error) { console.error('Journal authentication failed:', error); return Response.json({ error: '登录验证暂不可用' }, { status: 503 }); }
  if (!user) { console.warn('Journal request has no authenticated user'); return Response.json({ error: '请先登录' }, { status: 401 }); }
  if (request.method === 'GET') {
    try { return Response.json({ ...await loadJournal(user.id), aiReady: !!process.env.DEEPSEEK_API_KEY }); }
    catch (error) { console.error('Journal load failed:', error); return Response.json({ error: '云端记录读取失败' }, { status: 503 }); }
  }
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: '请求来源无效' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: '请求格式无效' }, { status: 400 }); }
  if (body.action === 'frequency' && (body.frequency === 'week' || body.frequency === 'month')) {
    return Response.json(await updateJournal(user.id, data => ({ ...data, frequency: body.frequency as 'week' | 'month' })));
  }
  if (body.action === 'delete' && typeof body.gameId === 'string') {
    return Response.json(await updateJournal(user.id, data => ({ ...data, watched: data.watched.filter(record => record.gameId !== body.gameId) })));
  }
  if (body.action === 'upsert') {
    const record = body.record as WatchedGame | undefined;
    if (!record || typeof record.gameId !== 'string' || record.gameId.length > 100 ||
      typeof record.date !== 'string' || !/^20\d\d-\d\d-\d\dT/.test(record.date) ||
      typeof record.away !== 'string' || typeof record.home !== 'string' ||
      typeof record.note !== 'string' || record.note.length > 1000 ||
      (record.photos !== undefined && (!Array.isArray(record.photos) || record.photos.length > MAX_PHOTOS_PER_GAME || !record.photos.every(id => typeof id === 'string' && PHOTO_ID_PATTERN.test(id)))) ||
      !(!record.mood || MOODS.includes(record.mood))) return Response.json({ error: '记录格式无效' }, { status: 400 });
    return Response.json(await updateJournal(user.id, data => ({
      ...data,
      watched: [...data.watched.filter(item => item.gameId !== record.gameId), { ...record, updatedAt: new Date().toISOString() }],
    })));
  }
  return Response.json({ error: '操作无效' }, { status: 400 });
}
