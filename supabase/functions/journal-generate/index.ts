import { createClient } from 'npm:@supabase/supabase-js@2';
import { dateInChina, diaryPrompt, duePeriod, periodBounds, requestDiaryText, type GameRecord, type Period } from './logic.ts';

const allowedOrigins = new Set(['https://luckye1120.github.io', 'http://localhost:3000', 'http://127.0.0.1:3000']);
const projectUrl = Deno.env.get('SUPABASE_URL')!;
const publishableKey = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default as string;
const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default as string;
const admin = createClient(projectUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

type JournalResult = { status: 'exists' | 'empty' | 'generated'; diary?: unknown };

function cors(origin: string | null): HeadersInit {
  return origin && allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } : {};
}

function reply(body: unknown, status = 200, origin: string | null = null): Response {
  return Response.json(body, { status, headers: cors(origin) });
}

async function generate(userId: string, period: Period, from: string, to: string, replace: boolean): Promise<JournalResult> {
  const existing = await admin.from('diaries').select('diary').eq('user_id', userId).eq('period', period).eq('from_date', from).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data && !replace) return { status: 'exists', diary: existing.data.diary };
  const watched = await admin.from('watched_games').select('record').eq('user_id', userId);
  if (watched.error) throw watched.error;
  const records = (watched.data || []).map(row => row.record as GameRecord).filter(record => {
    const date = dateInChina(record.date);
    return date >= from && date <= to;
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (!records.length) return { status: 'empty' };
  const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
  if (!deepseekKey) throw new Error('DeepSeek 尚未配置。');
  const text = await requestDiaryText(deepseekKey, diaryPrompt(records, from, to));
  const diary = { id: `${userId}:${period}:${from}`, period, from, to, text, gameIds: records.map(record => record.gameId), createdAt: new Date().toISOString(), source: 'ai' };
  const saved = await admin.from('diaries').upsert({ user_id: userId, period, from_date: from, to_date: to, diary }, { onConflict: 'user_id,period,from_date' });
  if (saved.error) throw saved.error;
  return { status: 'generated', diary };
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: allowedOrigins.has(origin || '') ? 204 : 403, headers: cors(origin) });
  if (request.method !== 'POST') return reply({ error: '仅支持 POST' }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return reply({ error: '请求来源无效' }, 403, origin);
  let body: { scheduled?: boolean; period?: Period; from?: string; to?: string };
  try { body = await request.json(); } catch { return reply({ error: '请求格式无效' }, 400, origin); }
  const cronToken = request.headers.get('x-cron-token');
  const cronCheck = body.scheduled && !origin && cronToken
    ? await admin.rpc('verify_journal_cron_token', { supplied_token: cronToken })
    : null;
  const isCron = cronCheck?.data === true && !cronCheck.error;
  if (body.scheduled && isCron) {
    const profiles = await admin.from('journal_profiles').select('user_id,frequency');
    if (profiles.error) return reply({ error: '用户列表读取失败' }, 503);
    const today = dateInChina(new Date().toISOString());
    let generated = 0, skipped = 0, failed = 0;
    for (const profile of profiles.data || []) {
      try {
        const period: Period = profile.frequency === 'month' ? 'month' : 'week';
        const bounds = duePeriod(today, period);
        const result = await generate(profile.user_id, period, bounds.from, bounds.to, false);
        if (result.status === 'generated') generated++; else skipped++;
      } catch (error) { failed++; console.error('Scheduled diary failed for user', profile.user_id, error); }
    }
    return reply({ generated, skipped, failed });
  }
  if (body.scheduled) return reply({ error: '定时任务认证失败' }, 401, origin);
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return reply({ error: '请先登录' }, 401, origin);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return reply({ error: '登录已失效，请重新登录' }, 401, origin);
  if ((body.period !== 'week' && body.period !== 'month') || !body.from || !body.to || !/^20\d\d-\d\d-\d\d$/.test(body.from) || periodBounds(body.from, body.period).to !== body.to) return reply({ error: '周期无效' }, 400, origin);
  try {
    const result = await generate(user.id, body.period, body.from, body.to, true);
    return reply(result.status === 'empty' ? { error: '这个周期还没有观赛记录' } : result, result.status === 'empty' ? 400 : 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成失败，请稍后重试';
    console.error('Diary generation failed:', message);
    return reply({ error: message }, 502, origin);
  }
});
