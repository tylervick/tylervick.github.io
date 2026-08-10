import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage } from '../build/html.mjs';

const root = new URL('../', import.meta.url);
const resume = JSON.parse(readFileSync(new URL('resume.json', root)));
const onDisk = readFileSync(new URL('index.html', root), 'utf8');

test('committed index.html is up to date with resume.json', () => {
  assert.equal(
    onDisk,
    renderPage(resume),
    'index.html is stale — run `node build.mjs` and commit the result',
  );
});

test('generated HTML is balanced', () => {
  const open = (onDisk.match(/<div\b/g) ?? []).length;
  const close = (onDisk.match(/<\/div>/g) ?? []).length;
  assert.equal(open, close, 'unbalanced <div> tags');
});

test('style.css contains no deck-size data', () => {
  const css = readFileSync(new URL('style.css', root), 'utf8');
  assert.doesNotMatch(css, /--count\s*:/, '--count belongs inline on .deck');
  assert.doesNotMatch(css, /\.card:nth-child/, 'card index belongs inline on each .card');
});
