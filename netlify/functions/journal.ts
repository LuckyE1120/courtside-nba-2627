import { getUser } from '@netlify/identity';
import { MOODS, type WatchedGame } from '../../lib/journal';
import { loadJournal, updateJournal } from '../lib/journal-store';

export default async function handler(request: Request): Promise<Response> {
  const user = await getUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  if (request.method === 'GET') return Response.json({ ...await loadJournal(user.id), aiReady: !!process.env.OPENAI_API_KEY });
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
      !(!record.mood || MOODS.includes(record.mood))) return Response.json({ error: '记录格式无效' }, { status: 400 });
    return Response.json(await updateJournal(user.id, data => ({
      ...data,
      watched: [...data.watched.filter(item => item.gameId !== record.gameId), { ...record, updatedAt: new Date().toISOString() }],
    })));
  }
  return Response.json({ error: '操作无效' }, { status: 400 });
}
