import assert from 'node:assert/strict';
import { it } from 'node:test';
import request from 'supertest';
import { createApp, type LeadStore } from '../src/app.js';
import { createAiProvider, MockAiProvider, OpenAiProvider } from '../src/ai.js';

const store = {} as LeadStore; // AI analysis has no dependency on lead persistence.

it('analyzes the submitted conversation through the mock endpoint without credentials', async () => {
  const app = createApp(store, createAiProvider({ AI_PROVIDER: 'mock' }));
  const high = await request(app).post('/api/ai/analyze').send({ conversation: 'Quiero contratar y agendar una demo' });
  const low = await request(app).post('/api/ai/analyze').send({ conversation: 'Hola' });
  assert.equal(high.status, 200);
  assert.equal(high.body.data.provider, 'mock');
  assert.equal(high.body.data.intent, 'alta');
  assert.ok(high.body.data.score > low.body.data.score);
  assert.match(high.body.data.summary, /simulado/);
});

it('rejects empty, missing, oversized and non-string conversation input', async () => {
  for (const body of [{}, { conversation: ' ' }, { conversation: 42 }, { conversation: 'x'.repeat(12001) }, { conversation: 'Hola', extra: true }]) {
    assert.equal((await request(createApp(store)).post('/api/ai/analyze').send(body)).status, 400);
  }
});

it('returns a retryable provider failure without exposing credentials or internals', async () => {
  const response = await request(createApp(store, { name: 'openai', async analyze() { throw new Error('secret'); } }))
    .post('/api/ai/analyze').send({ conversation: 'Hola' });
  assert.equal(response.status, 502);
  assert.ok(!response.text.includes('secret'));
});

it('requires explicit valid provider configuration', () => {
  assert.equal(createAiProvider({}).name, 'mock');
  assert.throws(() => createAiProvider({ AI_PROVIDER: 'unknown' }));
  assert.throws(() => createAiProvider({ AI_PROVIDER: 'openai' }));
});

it('sends the conversation to OpenAI and validates the returned analysis using a fake transport', async () => {
  const expected = await new MockAiProvider().analyze('Quiero una demo');
  const provider = new OpenAiProvider('test-key', 'test-model', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(String(options?.body));
    assert.equal(body.messages[1].content, 'Quiero una demo');
    assert.equal(body.response_format.type, 'json_schema');
    return Response.json({ choices: [{ message: { content: JSON.stringify(expected) } }] });
  });
  assert.deepEqual(await provider.analyze('Quiero una demo'), expected);
  const invalid = new OpenAiProvider('test-key', 'test-model', async () => Response.json({ choices: [{ message: { content: '{"score":999}' } }] }));
  await assert.rejects(() => invalid.analyze('Hola'));
  const failed = new OpenAiProvider('test-key', 'test-model', async () => new Response('', { status: 429 }));
  await assert.rejects(() => failed.analyze('Hola'));
});
