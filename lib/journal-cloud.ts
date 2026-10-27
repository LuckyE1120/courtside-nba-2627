import { EMPTY_JOURNAL, type Diary, type DiaryPeriod, type JournalData, type WatchedGame } from './journal';
import { detectPhotoType, MAX_PHOTO_BYTES, PHOTO_ID_PATTERN } from './photo';
import { getSupabase } from './supabase';

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function loadCloudJournal(userId: string): Promise<JournalData> {
  const db = getSupabase();
  const [profile, watched, diaries] = await Promise.all([
    db.from('journal_profiles').select('frequency').eq('user_id', userId).maybeSingle(),
    db.from('watched_games').select('record').eq('user_id', userId),
    db.from('diaries').select('diary').eq('user_id', userId),
  ]);
  check(profile.error); check(watched.error); check(diaries.error);
  return {
    ...EMPTY_JOURNAL,
    frequency: profile.data?.frequency === 'month' ? 'month' : 'week',
    watched: (watched.data || []).map(row => row.record as WatchedGame),
    diaries: (diaries.data || []).map(row => row.diary as JournalData['diaries'][number]),
  };
}

export async function saveCloudWatched(userId: string, record: WatchedGame): Promise<void> {
  const result = await getSupabase().from('watched_games').upsert({ user_id: userId, game_id: record.gameId, record }, { onConflict: 'user_id,game_id' });
  check(result.error);
}

export async function deleteCloudWatched(userId: string, gameId: string): Promise<void> {
  const result = await getSupabase().from('watched_games').delete().eq('user_id', userId).eq('game_id', gameId);
  check(result.error);
}

export async function saveCloudFrequency(userId: string, frequency: DiaryPeriod): Promise<void> {
  const result = await getSupabase().from('journal_profiles').upsert({ user_id: userId, frequency }, { onConflict: 'user_id' });
  check(result.error);
}

export async function saveCloudDiary(userId: string, diary: Diary): Promise<void> {
  const result = await getSupabase().from('diaries').upsert({ user_id: userId, period: diary.period, from_date: diary.from, to_date: diary.to, diary }, { onConflict: 'user_id,period,from_date' });
  check(result.error);
}

async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) throw new Error('请先登录后管理照片。');
  return data.user.id;
}

export async function uploadPhoto(file: File): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES || !file.size) throw new Error('单张图片不能超过 2 MB。');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const type = detectPhotoType(bytes);
  if (!type || file.type !== type) throw new Error('只支持 JPG、PNG 或 WebP 图片。');
  const id = crypto.randomUUID();
  const userId = await currentUserId();
  const { error } = await getSupabase().storage.from('journal-images').upload(`${userId}/${id}`, file, { contentType: type, upsert: false });
  check(error);
  return id;
}

export async function deletePhoto(id: string): Promise<void> {
  if (!PHOTO_ID_PATTERN.test(id)) return;
  const userId = await currentUserId();
  const { error } = await getSupabase().storage.from('journal-images').remove([`${userId}/${id}`]);
  check(error);
}

export async function downloadPhoto(id: string): Promise<Blob> {
  if (!PHOTO_ID_PATTERN.test(id)) throw new Error('图片编号无效。');
  const userId = await currentUserId();
  const { data, error } = await getSupabase().storage.from('journal-images').download(`${userId}/${id}`);
  check(error);
  if (!data) throw new Error('图片不存在。');
  return data;
}

export async function requestDiary(period: DiaryPeriod, from: string, to: string): Promise<void> {
  const { data, error } = await getSupabase().functions.invoke('journal-generate', { body: { period, from, to } });
  if (error) {
    const response = 'context' in error ? error.context as Response | undefined : undefined;
    const detail = response ? await response.clone().json().catch(() => null) as { error?: string } | null : null;
    throw new Error(detail?.error || error.message || 'AI 日记生成失败。');
  }
  if (data?.error) throw new Error(data.error);
}
