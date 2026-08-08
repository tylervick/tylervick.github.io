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

test('location carries an IANA timezone for the footer clock', () => {
  const tz = resume.basics.location.timezone;
  assert.ok(tz, 'basics.location.timezone drives the footer clock — see build/html.mjs');
  assert.doesNotThrow(
    () => new Intl.DateTimeFormat('en-US', { timeZone: tz }),
    `"${tz}" is not a timezone Intl recognises, so the clock would throw in the browser`,
  );
});

test('no phone number is published', () => {
  // resume.json is served from the site root (Codeberg Pages serves the repo
  // root and robots.txt allows every crawler), so every field in this file is
  // public whether or not the rendered page shows it. The page deliberately
  // never showed the phone number; keeping it here published it anyway.
  assert.equal(resume.basics.phone, undefined, 'basics.phone is PII served at the site root');
  const raw = readFileSync(new URL('../resume.json', import.meta.url), 'utf8');
  assert.doesNotMatch(raw, /\+?\d[\d ()-]{8,}\d/, 'a phone-shaped string is present in resume.json');
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
