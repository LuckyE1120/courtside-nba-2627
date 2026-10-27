export type Period = 'week' | 'month';
export type GameRecord = { gameId: string; date: string; away: string; home: string; awayScore: number | null; homeScore: number | null; mood: string | null; note: string };

export function dateInChina(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

export function periodBounds(date: string, period: Period): { from: string; to: string } {
  const d = new Date(`${date}T12:00:00Z`);
  if (period === 'week') {
    const weekday = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - weekday);
    const from = d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 6);
    return { from, to: d.toISOString().slice(0, 10) };
  }
  const from = `${date.slice(0, 7)}-01`;
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return { from, to: d.toISOString().slice(0, 10) };
}

export function duePeriod(today: string, period: Period): { from: string; to: string } {
  const current = periodBounds(today, period);
  const day = new Date(`${current.from}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return periodBounds(day.toISOString().slice(0, 10), period);
}

export function diaryPrompt(records: GameRecord[], from: string, to: string): string {
  const lines = records.map(record => {
    const score = record.awayScore !== null && record.homeScore !== null ? `${record.awayScore}:${record.homeScore}` : '比分未记录';
    return `- ${dateInChina(record.date)} ${record.away} vs ${record.home}，${score}；心情：${record.mood || '未填写'}；我的感受：${record.note.trim() || '未填写'}`;
  });
  const hasNotes = records.some(record => record.note.trim());
  return `请根据以下真实观赛记录，写一篇中文第一人称 NBA 观赛日记，时间范围 ${from} 至 ${to}。${hasNotes ? '约 200 至 350 字' : '约 80 至 150 字；素材很少时宁可更短'}。只写已记录的比赛、比分、心情和本人感受；没有记录的细节一律省略。不要推测赛况、气氛、观赛体验或其他日期发生了什么，不要用“应该”“想必”等猜测语气，也不要反复解释哪些字段没有填写。第一行写简短标题，后面写一到两段正文；输出纯文本，不使用 Markdown 标记。\n\n${lines.join('\n')}`;
}

export async function requestDiaryText(key: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-flash',
      messages: [
        { role: 'system', content: '你是一名严谨的中文体育日记编辑。只根据输入中已记录的事实写作，不捏造比赛过程、球员表现或观众经历。素材有限时保持简短，不为了字数编造或推测。只输出纯文本。' },
        { role: 'user', content: prompt },
      ],
      thinking: { type: 'disabled' },
      max_tokens: 1000,
    }),
  });
  if (!response.ok) {
    if (response.status === 402) throw new Error('DeepSeek API 余额不足，请在 DeepSeek 开放平台充值。');
    if (response.status === 401) throw new Error('DeepSeek API Key 无效，请检查服务端配置。');
    throw new Error(`DeepSeek 服务暂时不可用（HTTP ${response.status}）`);
  }
  const output = await response.json() as { choices?: { message?: { content?: string | null }; finish_reason?: string }[] };
  const choice = output.choices?.[0];
  if (choice?.finish_reason === 'length') throw new Error('DeepSeek 返回的日记不完整，请稍后重试。');
  const text = choice?.message?.content?.trim();
  if (!text) throw new Error('AI 服务没有返回日记内容。');
  return text;
}
