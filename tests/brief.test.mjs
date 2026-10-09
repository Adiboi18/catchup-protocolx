import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceExcerpt, cleanBriefTakeaway, buildBrief } from '../dist/brief.js';
import { analyzeChat, exportBrief } from '../dist/engine.js';

test('long announcement excerpt retains event context and late deadline without rewriting the facts', () => {
  const source = `[Forwarded many times] *Campus Build Weekend 2026*\nDear Students,\nThe event is sponsored by the campus association.\n${'Enjoy building projects and meeting classmates.\n'.repeat(20)}Team Formation:\nEach team must have 4 to 5 students.\nEvery student must register for the learning portal.\n*Registration closes: 15 October 2026*`;
  const result = evidenceExcerpt(source);
  assert.match(result, /Campus Build Weekend 2026/);
  assert.match(result, /4 to 5 students/);
  assert.match(result, /Registration closes: 15 October 2026/);
  assert.ok(result.length < 620);
  assert.doesNotMatch(result, /Forwarded|\*/);
});

test('compact brief retains team requirements and closing date, strips signature, and marks abridgement', () => {
  const source =
    'Campus Build Weekend\nDear Students,\n' +
    'Meet fellow makers and learn new skills.\n'.repeat(12) +
    'Each team must have 4 to 5 students.\nEach team can submit only ONE idea.\nRegistration closes: 15 October 2026\nRegards\nThe organizing committee';
  const excerpt = cleanBriefTakeaway(source);
  assert.match(excerpt, /Campus Build Weekend/);
  assert.match(excerpt, /4 to 5 students/);
  assert.match(excerpt, /15 October 2026/);
  assert.doesNotMatch(excerpt, /organizing committee|Dear Students/);
  assert.match(excerpt, /…/);
});

test('personalized brief avoids duplicates, excludes completed tasks and matches exported facts', () => {
  const d = analyzeChat(
    'Maya: We decided to use the library hall.\nArun: @Sam please send slides by 2 PM.\nLeena: @Sam please send slides by 2 PM.\nMaya: Please bring your ID.',
    'Sam',
  );
  const b = buildBrief(d);
  assert.equal(b.personal.length, 1);
  assert.match(b.personal[0].excerpt, /@Sam/);
  assert.ok(!b.overview.some((item) => item.excerpt === b.personal[0].excerpt));
  const done = buildBrief(d, new Set([2, 3]));
  assert.equal(done.personal.length, 0);
  assert.ok(!done.overview.some((item) => [2, 3].includes(item.id)));
  const exported = exportBrief(d);
  assert.match(exported, /## For you/);
  for (const item of [...b.overview, ...b.personal, ...b.nextSteps])
    assert.ok(exported.includes(item.excerpt));
});

test('ordinary pasted prose produces a readable source-backed brief without action keywords', () => {
  const d = analyzeChat(
    'The club met in the garden.\nMembers shared sketches of their favorite trees.\nThe discussion explored shade and community spaces.',
  );
  const b = buildBrief(d);
  assert.ok(b.overview.length > 0);
  assert.ok(b.overview.some((item) => /garden|sketches|shade/.test(item.excerpt)));
});

test('brief quotes short messages and keeps uploaded markup as inert text', () => {
  assert.equal(
    evidenceExcerpt('@Sam please send the slides by 2 PM.'),
    '@Sam please send the slides by 2 PM.',
  );
  assert.equal(evidenceExcerpt('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>');
  assert.match(evidenceExcerpt('See [guide](https://example.test/guide)'), /guide/);
});
