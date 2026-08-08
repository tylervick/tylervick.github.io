import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRange, groupByEmployer } from '../build/resume.mjs';

test('formatRange: ongoing role shows an open range', () => {
  assert.equal(formatRange('2026-06', undefined), '2026—');
});

test('formatRange: multi-year role abbreviates the end year', () => {
  assert.equal(formatRange('2024-05', '2026-06'), '2024—26');
  assert.equal(formatRange('2011-11', '2015-08'), '2011—15');
});

test('formatRange: same-year role shows one year', () => {
  assert.equal(formatRange('2024-02', '2024-05'), '2024');
});

// Deliberately NOT pre-sorted: employers are interleaved and Snap's three
// roles are out of order, so a broken/missing sort in groupByEmployer cannot
// hide behind Map insertion order already matching the expected output.
const WORK = [
  { name: 'Snap Inc.', position: 'QA Engineer', startDate: '2017-06', endDate: '2019-05', highlights: ['c'] },
  { name: 'Acme Corp.', position: 'Long Stint', startDate: '2010-01', endDate: '2015-01' },
  { name: 'Kagi Inc.', position: 'Browser Extension Support Engineer', startDate: '2024-02', endDate: '2024-05' },
  { name: 'Snap Inc.', position: 'Senior Software Engineer', startDate: '2020-08', endDate: '2024-02', highlights: ['b'] },
  { name: 'Function Health', position: 'Software Engineer', startDate: '2026-06' },
  { name: 'Acme Corp.', position: 'Rotation Lead', startDate: '2012-01', endDate: '2013-01' },
  { name: 'The Walt Disney Studios', position: 'Staff Software Engineer', startDate: '2024-05', endDate: '2026-06', highlights: ['a'] },
  { name: 'Snap Inc.', position: 'Quality Engineer', startDate: '2019-05', endDate: '2020-08' },
];

test('groupByEmployer: one group per employer', () => {
  const g = groupByEmployer(WORK);
  assert.deepEqual(g.map(x => x.name), [
    'Function Health', 'The Walt Disney Studios', 'Kagi Inc.', 'Snap Inc.', 'Acme Corp.',
  ]);
});

test('groupByEmployer: Snap keeps all three roles, newest first', () => {
  const snap = groupByEmployer(WORK).find(g => g.name === 'Snap Inc.');
  assert.equal(snap.roles.length, 3);
  assert.deepEqual(snap.roles.map(r => r.position), [
    'Senior Software Engineer', 'Quality Engineer', 'QA Engineer',
  ]);
});

test('groupByEmployer: group span runs from earliest start to latest end', () => {
  const snap = groupByEmployer(WORK).find(g => g.name === 'Snap Inc.');
  assert.equal(snap.startDate, '2017-06');
  assert.equal(snap.endDate, '2024-02');
});

test('groupByEmployer: a group with any open role is itself open', () => {
  const fn = groupByEmployer(WORK)[0];
  assert.equal(fn.endDate, undefined);
});

test('groupByEmployer: highlights collect across the group roles', () => {
  const snap = groupByEmployer(WORK).find(g => g.name === 'Snap Inc.');
  assert.deepEqual(snap.highlights, ['b', 'c']);
});

test('groupByEmployer: groups are ordered most recent first', () => {
  const g = groupByEmployer(WORK);
  const starts = g.map(x => x.startDate);
  assert.deepEqual(starts, [...starts].sort().reverse());
});

test('groupByEmployer: overlapping roles use the latest end, not the most recently started one', () => {
  // Rotation Lead starts later (2012-01) but ends earlier (2013-01) than
  // Long Stint (2010-01–2015-01). The group's end must be the max across
  // all roles, not the endDate of whichever role has the latest startDate.
  const acme = groupByEmployer(WORK).find(g => g.name === 'Acme Corp.');
  assert.equal(acme.startDate, '2010-01');
  assert.equal(acme.endDate, '2015-01');
});
