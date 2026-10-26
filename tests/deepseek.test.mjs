import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { requestDiaryText } from '../netlify/lib/deepseek.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('sends a private DeepSeek chat request and returns the complete diary', async () => {
  let sent;
  globalThis.fetch = async (url, options) => {
    sent = { url, options };
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '  我的观赛周记  ' } }] });
  };
  assert.equal(await requestDiaryText('test-key', '两场比赛'), '我的观赛周记');
  assert.equal(sent.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(sent.options.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(sent.options.body);
  assert.equal(body.model, 'deepseek-flash');
  assert.equal(body.messages[1].content, '两场比赛');
  assert.deepEqual(body.thinking, { type: 'disabled' });
});

test('reports insufficient balance without saving partial content', async () => {
  globalThis.fetch = async () => new Response(null, { status: 402 });
  await assert.rejects(requestDiaryText('test-key', 'prompt'), /余额不足/);
});

test('rejects a truncated completion', async () => {
  globalThis.fetch = async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '半篇日记' } }] });
  await assert.rejects(requestDiaryText('test-key', 'prompt'), /不完整/);
});
