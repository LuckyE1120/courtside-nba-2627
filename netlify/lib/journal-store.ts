import { getStore } from '@netlify/blobs';
import { EMPTY_JOURNAL, type JournalData } from '../../lib/journal';

const storeName = 'courtside-journals';
const userKey = (userId: string) => `users/${encodeURIComponent(userId)}`;

export async function loadJournal(userId: string): Promise<JournalData> {
  const raw = await getStore(storeName).get(userKey(userId), { type: 'json' });
  return normalizeJournal(raw);
}

function normalizeJournal(value: unknown): JournalData {
  if (!value || typeof value !== 'object') return { ...EMPTY_JOURNAL };
  const data = value as Partial<JournalData>;
  return {
    version: 1,
    watched: Array.isArray(data.watched) ? data.watched : [],
    diaries: Array.isArray(data.diaries) ? data.diaries : [],
    frequency: data.frequency === 'month' ? 'month' : 'week',
  };
}

export async function updateJournal(
  userId: string,
  change: (current: JournalData) => JournalData | Promise<JournalData>,
): Promise<JournalData> {
  const store = getStore(storeName);
  const key = userKey(userId);
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    const next = await change(normalizeJournal(existing?.data));
    const written = await store.setJSON(key, next, existing?.etag ? { onlyIfMatch: existing.etag } : { onlyIfNew: true });
    if (written.modified) return next;
  }
  throw new Error('观赛记录同时发生多次修改，请重试。');
}

export async function* journalUserIds(): AsyncGenerator<string> {
  const store = getStore(storeName);
  for await (const page of store.list({ prefix: 'users/', paginate: true })) {
    for (const blob of page.blobs) {
      if (blob.key.startsWith('users/')) yield decodeURIComponent(blob.key.slice('users/'.length));
    }
  }
}
