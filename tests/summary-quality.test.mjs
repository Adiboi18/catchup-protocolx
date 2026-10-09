import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSummary, combineSummaries } from '../dist/summary-quality.js';

const SOURCE = `Maya: Hackfest registration closes on 15 October 2026. Form a team of 4 students.
Arun: Bring a printed Python lab sheet tomorrow.
Teacher: Submit the maths homework in the next class. The IDT class is in CV Raman block 310.
Maya: I will send the slides at 2 PM. Arun: I will send the slides at 3 PM.`;

test('rejects the observed repeated-label and formatting failure', () => {
  const broken =
    'Message: '.repeat(35) +
    '* '.repeat(35) +
    'The following is a list of the most important and most important information you will need to know about the project.';
  assert.equal(assessSummary(broken, SOURCE).ok, false);
  assert.equal(
    assessSummary('Bring the lab sheet. Bring the lab sheet. Bring the lab sheet.', SOURCE).ok,
    false,
  );
});

test('rejects instruction echoes and fluent generic filler', () => {
  assert.equal(
    assessSummary(
      'Summarize the following text in one or two sentences: Hackfest registration closes on 15 October.',
      SOURCE,
    ).ok,
    false,
  );
  assert.equal(
    assessSummary(
      'The following is a list of the most important information you need to know about the project.',
      SOURCE,
    ).ok,
    false,
  );
  assert.equal(
    assessSummary(
      'The conversation describes exciting developments in distant galaxies and black holes.',
      SOURCE,
    ).ok,
    false,
  );
});

test('rejects invented quantities while accepting the original date and room number', () => {
  assert.equal(assessSummary('Hackfest registration closes on 16 October 2026.', SOURCE).ok, false);
  assert.equal(assessSummary('Form a Hackfest team of five students.', SOURCE).ok, false);
  assert.equal(
    assessSummary(
      'Hackfest registration closes on 15 October 2026; the IDT class is in block 310.',
      SOURCE,
    ).ok,
    true,
  );
});

test('accepts a concise overview covering several supported topics', () => {
  const output =
    '  Hackfest registration closes on 15 October. Bring the Python lab sheet tomorrow and submit maths homework in the next class.  ';
  const result = assessSummary(output, SOURCE);
  assert.equal(result.ok, true);
  assert.equal(result.text, output.trim());
});

test('deduplicates repeated and superficially rewritten sentences while retaining distinct facts', () => {
  const result = combineSummaries(
    [
      'Hackfest registration closes on 15 October. Bring the Python lab sheet tomorrow.',
      'Hackfest registration closes 15 October. The IDT class is in CV Raman block 310.',
      'Maya will send the slides at 2 PM. Arun will send the slides at 3 PM.',
    ],
    SOURCE,
  );
  assert.equal(result.ok, true);
  assert.equal((result.text.match(/Hackfest registration closes/g) || []).length, 1);
  for (const fact of [
    'Python lab sheet',
    'block 310',
    'Maya will send',
    '2 PM',
    'Arun will send',
    '3 PM',
  ]) {
    assert.ok(result.text.includes(fact), fact);
  }
});

test('keeps differences in negation, quantities and who sends to whom', () => {
  const source =
    'Maya sends Arun the slides. Arun sends Maya the slides. Registration is required. Registration is not required. The lab is in room 310. The lab is in room 311.';
  const result = combineSummaries(
    [
      'Maya sends Arun the slides. Registration is required. The lab is in room 310.',
      'Arun sends Maya the slides. Registration is not required. The lab is in room 311.',
    ],
    source,
  );
  assert.equal(result.ok, true);
  for (const fact of [
    'Maya sends Arun',
    'Arun sends Maya',
    'is required',
    'is not required',
    'room 310',
    'room 311',
  ]) {
    assert.ok(result.text.includes(fact), fact);
  }
});

test('one failed chunk rejects the entire generated overview instead of hiding omitted coverage', () => {
  const result = combineSummaries(
    ['Bring the Python lab sheet tomorrow.', 'Message: Message: Message: * * * * * *'],
    SOURCE,
  );
  assert.equal(result.ok, false);
  assert.equal(result.text, '');
  assert.ok(result.reason.length > 0);
});
