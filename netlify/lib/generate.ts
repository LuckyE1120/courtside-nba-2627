import { dateInChina, diaryPrompt, duePeriod, gamesInPeriod, type DiaryPeriod, type JournalData } from '../../lib/journal';
import { loadJournal, updateJournal } from './journal-store';
import { requestDiaryText } from './deepseek';

export async function generateDiary(userId: string, period: DiaryPeriod, from: string, to: string, replace = false) {
  const current = await loadJournal(userId);
  const existing = current.diaries.find(d => d.period === period && d.from === from);
  if (existing && !replace) return { status: 'exists', diary: existing };
  const records = gamesInPeriod(current.watched, from, to);
  if (!records.length) return { status: 'empty' };
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { status: 'missing_key' };
  const text = await requestDiaryText(key, diaryPrompt(records, from, to), process.env.DEEPSEEK_MODEL || 'deepseek-flash');
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
