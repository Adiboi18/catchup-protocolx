import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeChat, buildAIInput } from '../dist/engine.js';

test('model input keeps short messages intact across chunks and skips content-free placeholders', () => {
  const text =
    'The exhibition opens on 15 October 2026. ' +
    'Prepare display materials carefully. '.repeat(30);
  const messages = [1, 2, 3].map((id) => ({ id, sender: `Person ${id}`, text }));
  messages.push({ id: 4, sender: 'Message', text: '<Media omitted>' });
  messages.push({
    id: 5,
    sender: 'Message',
    text: '*Forwarded*\n[Register Here](https://example.test/register)',
  });
  const model = buildAIInput({ messages, findings: [] });
  assert.equal(model.totalCount, 4);
  assert.equal(model.selectedCount, 4);
  for (const message of messages.slice(0, 3)) {
    assert.ok(model.chunks.some((chunk) => chunk.includes(`${message.sender}: ${text.trim()}`)));
  }
  assert.ok(model.chunks.every((chunk) => chunk.split(/\s+/).filter(Boolean).length <= 250));
  assert.ok(!model.text.includes('Message:'));
  assert.ok(!model.text.includes('Media omitted'));
  assert.ok(!model.text.includes('https://'));
  assert.ok(model.text.includes('Register Here'));
});

test('long conversation retains a critical request at the end and bounds model input', (t) => {
  const lines = Array.from(
    { length: 3000 },
    (_, i) => `Maya: Discussion item ${i}: thanks for the update, see you later.`,
  );
  lines.push(
    'Arun: @Adyan please check the microphone. This is urgent; the sound check is blocked.',
  );
  const chat = lines.join('\n');
  assert.ok(chat.length <= 200000);
  const started = performance.now();
  const digest = analyzeChat(chat, 'Adyan');
  const elapsed = performance.now() - started;
  assert.equal(digest.messages.length, 3001);
  assert.equal(digest.findings[0].id, 3001);
  const ai = buildAIInput(digest);
  assert.ok(ai.text.includes('sound check is blocked'));
  assert.ok(ai.selectedCount < ai.totalCount);
  assert.ok(ai.chunks.every((chunk) => chunk.split(/\s+/).length <= 250));
  t.diagnostic(
    `Analyzed ${chat.length} characters / 3001 messages in ${elapsed.toFixed(1)} ms on this machine. Not a cross-device guarantee.`,
  );
});

test('malformed fixture and markup are parsed as data without requiring valid timestamps', async () => {
  const chat = await readFile(new URL('../samples/malformed.txt', import.meta.url), 'utf8');
  const digest = analyzeChat(chat, 'Adyan');
  assert.ok(digest.messages.length > 0);
  assert.ok(digest.allMessages.some((message) => message.text.includes('<img')));
});
