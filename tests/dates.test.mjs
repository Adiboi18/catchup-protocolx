import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDeadline } from '../dist/dates.js';

const OPTIONS = { asOf: '2026-10-09T12:00', dateFormat: 'day-first' };
const SOURCE = { date: '07/10/2026', time: '13:00', text: '' };

test('resolves announcement deadlines with full month names and preserves unknown clock time', () => {
  const registration = resolveDeadline('Registration closes: 15 October 2026', SOURCE, OPTIONS);
  assert.equal(registration.dateISO, '2026-10-15');
  assert.equal(registration.status, 'upcoming');
  assert.equal(registration.uncertain, false);
  assert.match(registration.display, /time not stated/);
  const pastForm = resolveDeadline('on or before 01 October 2026', SOURCE, OPTIONS);
  assert.equal(pastForm.dateISO, '2026-10-01');
  assert.equal(pastForm.status, 'overdue');
  assert.equal(pastForm.uncertain, false);
});

test('accepts month-first named dates and abbreviations independently of export date format', () => {
  const due = resolveDeadline('by October 15, 2026 at 2 PM', SOURCE, {
    ...OPTIONS,
    dateFormat: 'month-first',
  });
  assert.equal(due.dateISO, '2026-10-15');
  assert.equal(new Date(due.timestamp).getHours(), 14);
  assert.equal(due.uncertain, false);
  assert.equal(resolveDeadline('by 15 Oct 2026', SOURCE, OPTIONS).dateISO, '2026-10-15');
  assert.equal(resolveDeadline('by 31 September 2026', SOURCE, OPTIONS).status, 'unknown');
  const inferred = resolveDeadline('by 15 October', SOURCE, OPTIONS);
  assert.equal(inferred.dateISO, '2026-10-15');
  assert.equal(inferred.uncertain, true);
});

test('dot-separated class times use tomorrow from the source message and do not become dates', () => {
  const message = {
    ...SOURCE,
    text: 'Tomorrow the geometry class is at 8.30 am and the physics class is at 9.25 am.',
  };
  const first = resolveDeadline('at 8.30 am', message, OPTIONS);
  const second = resolveDeadline('at 9.25 am', message, OPTIONS);
  assert.equal(first.dateISO, '2026-10-08');
  assert.equal(second.dateISO, '2026-10-08');
  assert.equal(new Date(first.timestamp).getHours(), 8);
  assert.equal(new Date(first.timestamp).getMinutes(), 30);
  assert.equal(new Date(second.timestamp).getHours(), 9);
  assert.equal(new Date(second.timestamp).getMinutes(), 25);
  assert.equal(first.status, 'overdue');
  assert.equal(first.uncertain, false);
});

test('next class stays unresolved instead of inventing a same-day deadline', () => {
  const nextClass = resolveDeadline('in the next class', SOURCE, OPTIONS);
  assert.equal(nextClass.status, 'unknown');
  assert.equal(nextClass.uncertain, true);
  assert.equal(nextClass.dateISO, undefined);
  assert.match(nextClass.explanation, /Confirm the schedule/);
  assert.equal(resolveDeadline('by 10 AM next class', SOURCE, OPTIONS).status, 'unknown');
  assert.equal(
    resolveDeadline(
      'next class',
      {
        ...SOURCE,
        text: "Please solve today's geometry exercises and submit in the next class.",
      },
      OPTIONS,
    ).status,
    'unknown',
  );
});

test('date ranges retain written evidence without inventing a single due date', () => {
  for (const label of [
    'Registration: 15–16 October 2026',
    'Scheduled: 15 October 2026 to 16 October 2026',
    'Date: September 29–30, 2026',
    'Date: 2026-10-15 to 2026-10-16',
    'Date: 15/10/2026–16/10/2026',
  ]) {
    const due = resolveDeadline(label, SOURCE, OPTIONS);
    assert.equal(due.label, label);
    assert.equal(due.status, 'unknown');
    assert.equal(due.uncertain, true);
    assert.equal(due.dateISO, undefined);
    assert.match(due.explanation, /date range/);
  }
  assert.equal(resolveDeadline('by 2026-10-15', SOURCE, OPTIONS).dateISO, '2026-10-15');
});

test('numeric date format and PM source timestamps retain their configured interpretation', () => {
  const numeric = resolveDeadline('by 10/11/2026 at 4:30 PM', SOURCE, OPTIONS);
  assert.equal(numeric.dateISO, '2026-11-10');
  assert.equal(new Date(numeric.timestamp).getHours(), 16);
  const monthFirst = resolveDeadline('by 10/11/2026', SOURCE, {
    ...OPTIONS,
    dateFormat: 'month-first',
  });
  assert.equal(monthFirst.dateISO, '2026-10-11');
  const interval = resolveDeadline(
    'in 2 hours',
    {
      ...SOURCE,
      time: '1:30:20 PM',
    },
    OPTIONS,
  );
  assert.equal(new Date(interval.timestamp).getHours(), 15);
  assert.equal(new Date(interval.timestamp).getMinutes(), 30);
  assert.equal(interval.uncertain, false);
});
