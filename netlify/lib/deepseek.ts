export async function requestDiaryText(key: string, prompt: string, model = 'deepseek-flash'): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
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
    if (response.status === 401) throw new Error('DeepSeek API Key 无效，请检查网站服务端配置。');
    throw new Error(`DeepSeek 服务暂时不可用（HTTP ${response.status}）`);
  }
  const output = await response.json() as { choices?: { message?: { content?: string | null }; finish_reason?: string }[] };
  const choice = output.choices?.[0];
  if (choice?.finish_reason === 'length') throw new Error('DeepSeek 返回的日记不完整，请稍后重试。');
  const text = choice?.message?.content?.trim();
  if (!text) throw new Error('AI 服务没有返回日记内容。');
  return text;
}
