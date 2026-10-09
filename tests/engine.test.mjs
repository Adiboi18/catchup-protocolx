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

test('timestamped exports keep announcement labels and Markdown links in their original message', () => {
  const chat = `[07/10/2026, 11:45:00 AM] Mira: *Forwarded*
*Innovation Week*
Date: 15–16 October 2026
Registration closes: 15 October 2026
Venue: Science auditorium
[Register Here](https://example.test/register)
https://example.test/details
Bring your college ID.
[07/10/2026, 11:46:00 AM] Dev: Thanks for sharing.
[07/10/2026, 11:48:00 AM] Leela: Can someone check the projector? This is urgent.`;
  const digest = analyzeChat(chat, '', 1, OPTIONS);
  assert.equal(digest.messages.length, 3);
  assert.deepEqual(
    digest.messages.map((message) => message.sender),
    ['Mira', 'Dev', 'Leela'],
  );
  assert.ok(digest.messages[0].text.includes('Venue: Science auditorium'));
  assert.ok(digest.messages[0].text.includes('[Register Here](https://example.test/register)'));
  assert.ok(digest.messages[0].text.includes('Bring your college ID.'));
  const announcement = digest.findings.find((message) => message.id === 1);
  assert.ok(announcement.tags.includes('update'));
  assert.ok(
    announcement.deadlines.includes('Registration closes: 15 October 2026') ||
      announcement.deadlines.includes('closes: 15 October 2026'),
  );
  assert.equal(
    announcement.deadlineDetails.find((deadline) => deadline.label.includes('closes')).dateISO,
    '2026-10-15',
  );
  assert.equal(
    announcement.deadlineDetails.find((deadline) => deadline.label.includes('15–16')).uncertain,
    true,
  );
  assert.ok(digest.summaryMessages.some((message) => message.id === 1));
  assert.ok(digest.summaryMessages.some((message) => message.id === 3));
  const model = buildAIInput(digest);
  assert.ok(model.text.includes('Venue: Science auditorium'));
  assert.ok(model.text.includes('15 October 2026'));
  assert.ok(!model.text.includes('https://'));
  assert.ok(!model.text.includes('*'));
  assert.ok(!model.text.includes('Forwarded'));
  assert.ok(!model.text.includes('Message:'));
  // Model-only cleanup never alters source evidence or the exported brief.
  assert.ok(exportBrief(digest).includes('[Register Here](https://example.test/register)'));
});

test('captures each scheduled dot-time and preserves ambiguous next-class deadlines', () => {
  const chat = `[09/10/2026, 09:00] Mira: Tomorrow the briefing is at 8.30 am and the lab session starts at 9.25 am.
[09/10/2026, 09:05] Dev: Please submit the worksheet before next class.`;
  const digest = analyzeChat(chat, '', 1, OPTIONS);
  const schedule = digest.findings.find((message) => message.id === 1);
  assert.deepEqual(schedule.deadlines, ['8.30 am', 'starts at 9.25 am']);
  assert.ok(
    schedule.deadlineDetails.every(
      (deadline) => deadline.dateISO === '2026-10-10' && !deadline.uncertain,
    ),
  );
  const task = digest.findings.find((message) => message.id === 2);
  assert.ok(task.deadlines.includes('before next class'));
  assert.equal(task.deadlineDetails[0].status, 'unknown');
  assert.equal(task.deadlineDetails[0].uncertain, true);
  assert.deepEqual(extractDeadlines('Submit on or before 01 October 2026.'), [
    'on or before 01 October 2026',
  ]);
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

test('brief reserves recent instructions and explicit urgency despite older overdue announcements', () => {
  const old = Array.from(
    { length: 6 },
    (_, i) =>
      `[01/10/2026, 09:0${i}] Maya: Important: please complete registration by 1 October 2026. Announcement ${i}.`,
  ).join('\n');
  const chat =
    old +
    '\n[09/10/2026, 10:00] Maya: Please call me immediately; the display is blocked.\n[09/10/2026, 11:00] Arun: Students are informed to solve the exercises and submit them in the next class.\n[09/10/2026, 11:20] Leena: Please come to the library lab.';
  const d = analyzeChat(chat, '', 1, { asOf: '2026-10-09T15:00', dateFormat: 'day-first' });
  for (const id of [7, 8, 9]) assert.ok(d.summaryMessages.some((m) => m.id === id));
  assert.ok(d.summaryMessages.length <= 9);
  assert.ok(d.findings.find((m) => m.id === 8).tags.includes('action'));
});

test('known export notice and model noise do not become extra chat facts or repeated labels', () => {
  const chat =
    'Messages and calls are end-to-end encrypted. No one outside of this chat can read them.\n[09/10/2026, 10:00] +91 90000 10000: [Forwarded many times] Please register by 15 October 2026.\n[09/10/2026, 10:02] Maya: <message_history_notice message>';
  const d = analyzeChat(chat);
  assert.equal(d.messages.length, 2);
  const ai = buildAIInput(d);
  assert.equal(ai.totalCount, 1);
  assert.match(ai.text, /Please register/);
  assert.doesNotMatch(ai.text, /Forwarded|90000|message_history_notice/);
  assert.doesNotMatch(d.topics.join(' '), /forwarded|message|notice/);
});
