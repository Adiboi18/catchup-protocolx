import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeChat, buildAIInput } from '../dist/engine.js';

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
