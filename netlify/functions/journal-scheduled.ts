import { journalUserIds } from '../lib/journal-store';
import { generateDueDiary } from '../lib/generate';

export default async function handler(): Promise<void> {
  for await (const userId of journalUserIds()) {
    try { await generateDueDiary(userId); }
    catch (error) { console.error(`Diary generation failed for ${userId}:`, error); }
  }
}
