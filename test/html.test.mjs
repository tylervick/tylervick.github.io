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

// LITERAL 3, and it must STAY a literal — do not "clean this up" by importing
// MAX_CARD_HIGHLIGHTS from build/html.mjs.
//
// 3 is not an arbitrary number this test copied from the code; it is the
// number style.css was physically MEASURED against. The enhancement rule
// `.card__inner li:nth-child(n+2) { display: list-item }` has no upper bound —
// it reveals however many <li> the generator emits — and .card__inner is
// fixed-height with overflow:hidden, so bullet 4 and beyond clip mid-sentence
// with no visual warning. The only thing standing between the CSS and that
// regression is the DOM-side cap.
//
// Importing the constant makes the bound move with the code, so the assertion
// can never catch the code moving it: setting MAX_CARD_HIGHLIGHTS to 5 kept
// the suite at 48/48 while Disney and Snap each rendered 5 bullets —
// reintroducing exactly the clipping regression that took five review rounds
// to eliminate. Written as a literal, that same edit fails here, which is the
// point. If the cap ever legitimately changes, style.css must be re-measured
// across a width AND height matrix first, and this number updated by hand as
// the record of that measurement.
const CSS_MEASURED_MAX_BULLETS = 3;

test(`no card renders more than ${CSS_MEASURED_MAX_BULLETS} highlights`, () => {
  const cardBodies = html.split('class="card"').slice(1);
  assert.ok(cardBodies.length > 0, 'expected at least one card');
  for (const body of cardBodies) {
    const bullets = body.match(/<li>/g) ?? [];
    assert.ok(
      bullets.length <= CSS_MEASURED_MAX_BULLETS,
      `card rendered ${bullets.length} <li> elements, exceeding the measured cap of ` +
        `${CSS_MEASURED_MAX_BULLETS} — style.css clips anything past it`,
    );
  }
});

// Defence in depth for the test above, whose reach depends on the fixture: it
// only catches a raised cap while some employer actually HAS more than 3
// highlights to render (Disney and Snap have 5 each today). Trimming
// resume.json would quietly restore the vacuum. This pins the constant itself
// to the measured number, so the two can never diverge unnoticed. The
// comparison is to the literal — the imported value is the thing under test,
// never the bound.
test('the DOM-side cap still matches the number style.css was measured against', () => {
  assert.equal(
    MAX_CARD_HIGHLIGHTS,
    CSS_MEASURED_MAX_BULLETS,
    'MAX_CARD_HIGHLIGHTS changed without style.css being re-measured — see the ' +
      'HIGHLIGHT CAP comment in style.css before touching either',
  );
});

test('the runway is a real element', () => {
  assert.match(html, /class="runway"/);
});

test('the work history has landmark, heading and list semantics', () => {
  // Before this, the whole career was <div class="org"> inside anonymous divs:
  // the heading outline was H1 (tagline) then H2 ("Elsewhere"), so a screen
  // reader browsing by heading or landmark could not reach the work at all.
  assert.match(html, /<main>/, 'no main landmark');
  assert.match(html, /<section aria-labelledby="work-title">/, 'deck is not a named section');
  assert.match(html, /<h2 id="work-title" class="vh">Work history<\/h2>/, 'section has no heading');
  assert.match(html, /<footer class="wrap after">/, 'no contentinfo landmark');

  const orgs = html.match(/<h3 class="org">/g) ?? [];
  assert.equal(orgs.length, 7, 'every employer/school name must be a real heading');
  assert.doesNotMatch(html, /<div class="org">/, 'employer names must not be plain divs');

  // Deck list semantics are ARIA, not <ul>/<li> — style.css has unscoped
  // ul/li rules for the bullets, and a real <li> here would inherit
  // `position: relative` from them and destroy the sticky mechanic.
  assert.match(html, /class="wrap deck"[^>]*role="list"/, 'deck is not exposed as a list');
  assert.equal((html.match(/role="listitem"/g) ?? []).length, 7);
});

test('the footer city, timezone and year are derived from resume.json', () => {
  const page = renderPage({
    ...resume,
    basics: {
      ...resume.basics,
      location: { ...resume.basics.location, city: 'Lisbon', timezone: 'Europe/Lisbon' },
    },
  });
  assert.match(page, /class="fine">Lisbon /, 'footer city is not derived from basics.location');
  assert.ok(page.includes('"Europe/Lisbon"'), 'clock timezone is not derived from basics.location');
  assert.ok(!page.includes('America/Los_Angeles'), 'a hard-coded timezone survived');
  assert.ok(!page.includes('Berkeley'), 'a hard-coded city survived');
  // Derived from the build date — a literal year goes stale silently.
  assert.ok(page.includes(`· ${new Date().getFullYear()}<`), 'footer year is not the build year');
});

test('escapes the mailto address like every other interpolation', () => {
  const page = renderPage({
    ...resume,
    basics: { ...resume.basics, email: 'a&b"c@example.com' },
  });
  assert.ok(
    page.includes('href="mailto:a&amp;b&quot;c@example.com"'),
    'an unescaped & emits invalid HTML and an unescaped quote breaks out of the attribute',
  );
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
