import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groupByEmployer } from '../build/resume.mjs';
import { buildJsonLd } from '../build/jsonld.mjs';

const resume = JSON.parse(readFileSync(new URL('../resume.json', import.meta.url)));
const graph = buildJsonLd(resume, groupByEmployer(resume.work));
const node = type => graph['@graph'].find(n => n['@type'] === type);

test('graph declares the schema.org context', () => {
  assert.equal(graph['@context'], 'https://schema.org');
});

test('graph contains WebSite, ProfilePage and Person', () => {
  for (const t of ['WebSite', 'ProfilePage', 'Person']) {
    assert.ok(node(t), `missing ${t} node`);
  }
});

test('Person carries name, url and sameAs profiles', () => {
  const p = node('Person');
  assert.equal(p.name, 'Tyler Vick');
  assert.equal(p.url, 'https://tylervick.com');
  assert.ok(p.sameAs.some(u => u.includes('github.com')));
  assert.ok(p.sameAs.some(u => u.includes('linkedin.com')));
});

test('worksFor names the current employer only', () => {
  const p = node('Person');
  assert.equal(p.worksFor['@type'], 'Organization');
  assert.equal(p.worksFor.name, 'Function Health');
});

test('alumniOf covers past employers and the school', () => {
  const names = node('Person').alumniOf.map(o => o.name);
  assert.ok(names.includes('The Walt Disney Studios'));
  assert.ok(names.includes('Snap Inc.'));
  assert.ok(names.includes('Rochester Institute of Technology'));
  assert.ok(!names.includes('Function Health'), 'current employer belongs in worksFor');
});

test('address is the Bay Area', () => {
  assert.equal(node('Person').address.addressLocality, 'Bay Area');
});

test('highlights are never emitted as structured data', () => {
  // They are CSS-hidden on short viewports, so marking them up would describe
  // content some visitors cannot see.
  //
  // EVERY highlight is checked, not just the first. Checking only
  // flatMap(...)[0] made this test vacuous: adding
  // `knowsAbout: groups.flatMap(g => g.highlights).slice(-3)` to buildJsonLd
  // leaked three real highlights into the graph and the whole suite still
  // passed, because the one sampled highlight happened to be at the other end
  // of the list. A leak has no reason to start at index 0.
  const json = JSON.stringify(graph);
  const highlights = resume.work.flatMap(w => w.highlights ?? []);
  assert.ok(highlights.length > 0, 'fixture problem: resume has no highlights to check');
  for (const h of highlights) {
    assert.ok(!json.includes(h), `highlight text leaked into JSON-LD: "${h.slice(0, 60)}…"`);
  }
});

test('ProfilePage points at the Person node', () => {
  assert.equal(node('ProfilePage').mainEntity['@id'], node('Person')['@id']);
});
