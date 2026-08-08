import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const resume = JSON.parse(readFileSync(new URL('../resume.json', import.meta.url)));

test('Function Health is the current role', () => {
  const fn = resume.work.find(w => w.name === 'Function Health');
  assert.ok(fn, 'Function Health missing from work');
  assert.equal(fn.startDate, '2026-06');
  assert.equal(fn.endDate, undefined, 'current role must have no endDate');
  assert.equal(fn.position, 'Software Engineer');
});

test('Disney is closed out', () => {
  const d = resume.work.find(w => w.name === 'The Walt Disney Studios');
  assert.equal(d.endDate, '2026-06');
});

test('exactly one role is current', () => {
  const current = resume.work.filter(w => !w.endDate);
  assert.equal(current.length, 1);
  assert.equal(current[0].name, 'Function Health');
});

test('location is Berkeley', () => {
  assert.equal(resume.basics.location.city, 'Berkeley');
  assert.equal(resume.basics.location.region, 'CA');
});

test('summary does not hard-code a year count', () => {
  assert.doesNotMatch(
    resume.basics.summary,
    /\d+\+?\s*years/i,
    'a hard-coded year count goes stale — describe the work instead',
  );
});

test('every work entry has name, position and startDate', () => {
  for (const w of resume.work) {
    assert.ok(w.name, 'missing name');
    assert.ok(w.position, `missing position for ${w.name}`);
    assert.match(w.startDate, /^\d{4}-\d{2}$/, `bad startDate for ${w.name}`);
  }
});
