import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage, MAX_CARD_HIGHLIGHTS } from '../build/html.mjs';

const resume = JSON.parse(readFileSync(new URL('../resume.json', import.meta.url)));
const html = renderPage(resume);

test('renders a complete document', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<\/html>\s*$/);
  assert.match(html, /<link rel="stylesheet" href="style\.css"/);
});

test('deck declares its size inline, not in CSS', () => {
  assert.match(html, /class="[^"]*\bdeck\b[^"]*"[^>]*style="--count:7"/);
});

test('each card carries its own index', () => {
  for (let i = 0; i < 7; i++) {
    assert.ok(html.includes(`style="--i:${i}"`), `missing --i:${i}`);
  }
});

test('renders one card per employer plus the school', () => {
  const cards = html.match(/class="card"/g) ?? [];
  assert.equal(cards.length, 7);
});

test('Function Health leads the deck', () => {
  const first = html.indexOf('Function Health');
  const disney = html.indexOf('The Walt Disney Studios');
  assert.ok(first > -1 && first < disney);
});

test('Snap shows all three role titles in one card', () => {
  const card = html.split('class="card"').find(c => c.includes('Snap Inc.'));
  assert.ok(card.includes('Senior Software Engineer'));
  assert.ok(card.includes('Quality Engineer'));
  assert.ok(card.includes('QA Engineer'));
});

test(`no card renders more than ${MAX_CARD_HIGHLIGHTS} highlights`, () => {
  const cardBodies = html.split('class="card"').slice(1);
  assert.ok(cardBodies.length > 0, 'expected at least one card');
  for (const body of cardBodies) {
    const bullets = body.match(/<li>/g) ?? [];
    assert.ok(
      bullets.length <= MAX_CARD_HIGHLIGHTS,
      `card rendered ${bullets.length} <li> elements, exceeding the cap of ${MAX_CARD_HIGHLIGHTS}`,
    );
  }
});

test('the runway is a real element', () => {
  assert.match(html, /class="runway"/);
});

test('embeds the JSON-LD graph', () => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(m, 'no JSON-LD block');
  const graph = JSON.parse(m[1]);
  assert.equal(graph['@context'], 'https://schema.org');
});

test('escapes HTML-significant characters in content', () => {
  const page = renderPage({
    ...resume,
    basics: { ...resume.basics, name: 'A & B <script>' },
  });
  assert.ok(!page.includes('A & B <script>'));
  assert.ok(page.includes('A &amp; B &lt;script&gt;'));
});

test('contains no framework or content JavaScript beyond the clock', () => {
  const scripts = html.match(/<script(?![^>]*ld\+json)[^>]*>/g) ?? [];
  assert.equal(scripts.length, 1, 'expected exactly one script tag (the clock)');
});
