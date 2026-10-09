import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseChat,
  analyzeChat,
  mentionsName,
  extractDeadlines,
  buildAIInput,
  exportBrief,
  SAMPLE_CHAT,
} from '../dist/engine.js';
import { parseExportDate, resolveDeadline } from '../dist/dates.js';
const OPTIONS = { asOf: '2026-10-09T12:00', dateFormat: 'day-first' };

test('reads WhatsApp Android and iOS exports, keeping multiline message content', () => {
  const input =
    '[09/10/2026, 10:00:12 AM] Maya: Agenda:\nBring a charger\n09/10/2026, 10:03 AM - Arun: Please confirm the venue.';
  const messages = parseChat(input);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].text, 'Agenda:\nBring a charger');
  assert.equal(messages[1].sender, 'Arun');
});
test('matches names without matching substrings or interpreting regex characters', () => {
  assert.equal(mentionsName('Annual meeting', 'Ann'), false);
  assert.equal(mentionsName('@Ann please reply', 'Ann'), true);
  assert.equal(mentionsName('Hello A.B, can you check?', 'A.B'), true);
  assert.equal(mentionsName('Hello AxxB, can you check?', 'A.B'), false);
});

test('reads time-first WhatsApp Web text without losing date, owner or deadline', () => {
  const input =
    '[10:05, 09/10/2026] Maya: We decided to use the library hall.\n[10:08, 09/10/2026] Arun: @Adyan please send the slides by 2 PM today.';
  const digest = analyzeChat(input, 'Adyan', 1, OPTIONS);
  assert.equal(digest.messages.length, 2);
  assert.equal(digest.messages[0].date, '09/10/2026');
  assert.equal(digest.messages[1].time, '10:08');
  assert.equal(digest.findings[0].owner.name, 'Adyan');
  assert.equal(digest.findings[0].deadlineDetails[0].uncertain, false);
});
test('ranks urgent direct requests above casual conversation and decisions', () => {
  const digest = analyzeChat(SAMPLE_CHAT, 'Adyan', 1, OPTIONS);
  assert.equal(digest.allMessages.length, 18);
  assert.equal(digest.findings[0].id, 13);
  assert.ok(digest.findings[0].tags.includes('mention'));
  assert.equal(digest.findings.find((item) => item.id === 6).priority, 'high');
  assert.ok(!digest.findings.some((item) => item.id === 3));
});
test('unread selection excludes earlier findings while retaining all source messages', () => {
  const digest = analyzeChat(SAMPLE_CHAT, 'Adyan', 14, OPTIONS);
  assert.equal(digest.messages.length, 5);
  assert.equal(digest.allMessages.length, 18);
  assert.ok(digest.findings.every((item) => item.id >= 14));
});
test('preserves deadlines as written and does not turn due-to explanations into deadlines', () => {
  assert.deepEqual(extractDeadlines('Send slides by 2 PM today.'), ['by 2 PM today']);
  assert.deepEqual(extractDeadlines('Delayed due to rain.'), []);
  assert.ok(
    extractDeadlines('Registration closes at 5 PM today.').includes('closes at 5 PM today'),
  );
});
test('does not label explicitly completed work as a new task or negated urgency as urgent', () => {
  const digest = analyzeChat(
    'Maya: I have sent the slides, please note.\nArun: Can you check the microphone? It is not urgent.',
  );
  assert.equal(digest.findings.length, 1);
  assert.equal(digest.findings[0].priority, 'medium');
});
test('handles empty input and preserves malicious markup as text for safe rendering', () => {
  assert.equal(analyzeChat('').findings.length, 0);
  const digest = analyzeChat('Maya: Please review <img src=x onerror=alert(1)> by 2 PM.');
  assert.ok(digest.findings[0].text.includes('<img'));
});
test('AI input is bounded, includes urgent evidence and export contains source references', () => {
  const digest = analyzeChat(SAMPLE_CHAT, 'Adyan', 1, OPTIONS);
  const input = buildAIInput(digest);
  assert.ok(input.text.includes('microphone'));
  assert.ok(input.text.split(/\s+/).length <= 550);
  assert.ok(exportBrief(digest).includes('### #13'));
  assert.ok(exportBrief(digest).includes('Processed on-device'));
  const aiBrief = exportBrief(digest, 'Workshop preparations.');
  assert.ok(aiBrief.includes('Experimental local AI overview'));
  assert.ok(aiBrief.includes('## Extractive brief'));
  assert.ok(aiBrief.includes('library hall, not room 204'));
});
test('resolves relative days from the source date and flags past explicit times', () => {
  const message = { date: '08/10/2026', time: '09:00', text: 'Please upload tomorrow by 10 AM.' };
  const due = resolveDeadline('by 10 AM', message, OPTIONS);
  assert.equal(due.dateISO, '2026-10-09');
  assert.equal(due.status, 'overdue');
  assert.equal(due.uncertain, false);
  assert.equal(
    resolveDeadline('by 2 PM', { date: '', time: '', text: 'Please send by 2 PM.' }, OPTIONS)
      .uncertain,
    true,
  );
});
test('validates impossible dates and honors configured export date format', () => {
  assert.equal(parseExportDate('31/02/2026'), null);
  assert.equal(parseExportDate('10/09/2026', 'month-first').getMonth(), 9);
  assert.equal(parseExportDate('10/09/2026', 'day-first').getMonth(), 8);
  assert.equal(extractDeadlines('Submit by 2026-10-10.')[0], 'by 2026-10-10');
});
test('second conversation extracts named owners, commitments and explicit dates', () => {
  const chat = `09/10/2026, 09:00 - Sara: We agreed to submit an abstract about water conservation.
09/10/2026, 09:02 - Neha: Sounds good.
09/10/2026, 09:04 - Sara: @Neha please submit the abstract by 10/10/2026.
09/10/2026, 09:05 - Vikram: I'll prepare the diagrams.
09/10/2026, 09:06 - Sara: The budget is approved.
09/10/2026, 09:08 - Neha: Anyone want tea?`;
  const digest = analyzeChat(chat, 'Neha', 1, OPTIONS);
  assert.equal(digest.findings.find((f) => f.id === 3).owner.name, 'Neha');
  assert.equal(digest.findings.find((f) => f.id === 3).deadlineDetails[0].dateISO, '2026-10-10');
  assert.equal(digest.findings.find((f) => f.id === 4).owner.name, 'Vikram');
  assert.equal(digest.stats.decisions, 2);
  assert.ok(!digest.findings.some((f) => f.id === 6));
});
test('third, previously unseen chat works without timestamps and marks unknown owners/dates', () => {
  const chat = `Nora: The venue has changed to the science block.
Ishaan: Can someone check the HDMI cable? This is urgent.
Nora: @Kabir please upload the consent form by Friday.
Ishaan: I have sent the receipts, please note.
Nora: Can you review the checklist? It is not urgent.
Ishaan: Meet you after lunch.`;
  const digest = analyzeChat(chat, 'Kabir', 1, OPTIONS);
  assert.equal(digest.messages.length, 6);
  assert.equal(digest.findings[0].id, 2);
  assert.equal(digest.findings.find((f) => f.id === 2).owner.uncertain, true);
  assert.equal(digest.findings.find((f) => f.id === 3).owner.name, 'Kabir');
  assert.equal(digest.findings.find((f) => f.id === 3).deadlineDetails[0].uncertain, true);
  assert.ok(!digest.findings.some((f) => f.id === 4));
  assert.ok(digest.summaryMessages.some((f) => f.text.includes('science block')));
  const brief = exportBrief(digest, '', new Set([3]));
  assert.ok(brief.includes('Status: Completed'));
});
