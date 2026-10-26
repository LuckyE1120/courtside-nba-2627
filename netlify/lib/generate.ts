import { dateInChina, diaryPrompt, duePeriod, gamesInPeriod, type DiaryPeriod, type JournalData } from '../../lib/journal';
import { loadJournal, updateJournal } from './journal-store';

export async function generateDiary(userId: string, period: DiaryPeriod, from: string, to: string, replace = false) {
  const current = await loadJournal(userId);
  const existing = current.diaries.find(d => d.period === period && d.from === from);
  if (existing && !replace) return { status: 'exists', diary: existing };
  const records = gamesInPeriod(current.watched, from, to);
  if (!records.length) return { status: 'empty' };
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { status: 'missing_key' };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      instructions: '你是一名严谨的中文体育日记编辑。只根据输入中已记录的事实写作，不捏造比赛过程、球员表现或观众经历。',
      input: diaryPrompt(records, from, to),
      max_output_tokens: 1000,
    }),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({})) as { error?: { code?: string } };
    if (failure.error?.code === 'credit_balance_exhausted' || failure.error?.code === 'insufficient_quota') {
      throw new Error('OpenAI API 额度已用尽，请在 OpenAI Platform 账单页面补充额度。');
    }
    throw new Error(`AI 服务暂时不可用（HTTP ${response.status}）`);
  }
  const output = await response.json() as { output?: { content?: { type?: string; text?: string }[] }[] };
  const text = output.output?.flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text || '').join('\n').trim();
  if (!text) throw new Error('AI 服务没有返回日记内容。');
  const diary = { id: `${userId}:${period}:${from}`, period, from, to, text, gameIds: records.map(record => record.gameId), createdAt: new Date().toISOString(), source: 'ai' as const };
  await updateJournal(userId, data => ({ ...data, diaries: [...data.diaries.filter(d => !(d.period === period && d.from === from)), diary] }));
  return { status: 'generated', diary };
}

export async function generateDueDiary(userId: string, today = dateInChina(new Date().toISOString())) {
  const journal: JournalData = await loadJournal(userId);
  const due = duePeriod(today, journal.frequency);
  if (!due) return { status: 'not_due' };
  return generateDiary(userId, journal.frequency, due.from, due.to);
}
