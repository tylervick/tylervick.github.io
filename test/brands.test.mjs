import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRANDS } from '../build/brands.mjs';

const resume = JSON.parse(readFileSync(new URL('../resume.json', import.meta.url)));

test('every employer has a brand entry', () => {
  for (const w of resume.work) {
    assert.ok(BRANDS[w.name], `no brand mapping for "${w.name}"`);
  }
});

test('every school has a brand entry', () => {
  for (const e of resume.education) {
    assert.ok(BRANDS[e.institution], `no brand mapping for "${e.institution}"`);
  }
});

test('every brand entry has slug, label and display', () => {
  for (const [name, b] of Object.entries(BRANDS)) {
    assert.match(b.slug, /^b-[a-z]+$/, `bad slug for ${name}`);
    assert.ok(b.label.length > 0, `missing label for ${name}`);
    assert.ok(b.display.length > 0, `missing display for ${name}`);
  }
});

test('slugs are unique', () => {
  const slugs = Object.values(BRANDS).map(b => b.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug');
});
