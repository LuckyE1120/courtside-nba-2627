import { getUser } from '@netlify/identity';
import { periodBounds } from '../../lib/journal';
import { generateDiary } from '../lib/generate';

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const user = await getUser();
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: '请求来源无效' }, { status: 403 });
  let body: { period?: string; from?: string; to?: string };
  try { body = await request.json(); } catch { return Response.json({ error: '请求格式无效' }, { status: 400 }); }
  if ((body.period !== 'week' && body.period !== 'month') || !body.from || !body.to || !/^20\d\d-\d\d-\d\d$/.test(body.from) || periodBounds(body.from, body.period).to !== body.to) {
    return Response.json({ error: '周期无效' }, { status: 400 });
  }
  try {
    const result = await generateDiary(user.id, body.period, body.from, body.to, true);
    return Response.json(result, { status: result.status === 'missing_key' ? 503 : result.status === 'empty' ? 400 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成失败，请稍后重试';
    return Response.json({ error: message }, { status: message.includes('额度已用尽') ? 402 : 502 });
  }
}
