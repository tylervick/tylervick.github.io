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

const WORK = [
  { name: 'Function Health', position: 'Software Engineer', startDate: '2026-06' },
  { name: 'The Walt Disney Studios', position: 'Staff Software Engineer', startDate: '2024-05', endDate: '2026-06', highlights: ['a'] },
  { name: 'Kagi Inc.', position: 'Browser Extension Support Engineer', startDate: '2024-02', endDate: '2024-05' },
  { name: 'Snap Inc.', position: 'Senior Software Engineer', startDate: '2020-08', endDate: '2024-02', highlights: ['b'] },
  { name: 'Snap Inc.', position: 'Quality Engineer', startDate: '2019-05', endDate: '2020-08' },
  { name: 'Snap Inc.', position: 'QA Engineer', startDate: '2017-06', endDate: '2019-05', highlights: ['c'] },
];

test('groupByEmployer: one group per employer', () => {
  const g = groupByEmployer(WORK);
  assert.deepEqual(g.map(x => x.name), [
    'Function Health', 'The Walt Disney Studios', 'Kagi Inc.', 'Snap Inc.',
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
