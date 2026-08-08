import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const css = readFileSync(new URL('style.css', root), 'utf8');
const html = readFileSync(new URL('index.html', root), 'utf8');

// Strip comments so prose about an invariant never satisfies its own test.
const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

test('invariant 1: sticky is on the wrapper, not the visible card', () => {
  const card = rules.match(/\.card\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(card, /position:\s*sticky/, '.card must be the sticky element');
  const inner = rules.match(/\.card__inner\s*\{[^}]*\}/)?.[0] ?? '';
  assert.doesNotMatch(inner, /position:\s*sticky/, '.card__inner must never be sticky');
});

test('invariant 2: the pass has an exact height, not a floor', () => {
  const inner = rules.match(/\.card__inner\s*\{[^}]*\}/)?.[0] ?? '';
  assert.match(inner, /(^|[^-])height:\s*var\(--card-h\)/,
    'aligned release needs equal heights');
  assert.doesNotMatch(inner, /min-height:\s*var\(--card-h\)/,
    'min-height is a floor — content-heavy passes grow past it and release early');
});

test('invariant 3: the runway is an element, not padding', () => {
  assert.match(html, /class="runway"/, 'runway element missing from the deck');
  assert.match(rules, /\.runway\s*\{[^}]*height:/, '.runway must have a height');
  const deck = rules.match(/\.deck\s*\{[^}]*\}/)?.[0] ?? '';
  assert.doesNotMatch(deck, /padding-bottom/,
    'padding sits outside the containing block’s content box and grants no sticky travel');
});

test('invariant 4: svh only, never dvh', () => {
  assert.doesNotMatch(rules, /[\d.]+dvh/,
    'dvh re-resolves as the Safari toolbar collapses and resizes every pass mid-scroll');
  assert.match(rules, /[\d.]+svh/, 'expected svh units for the fit guard');
});

// invariant 5 — ADAPTED from the plan. style.css now has FOUR media queries
// in source order: (max-height:600px), (min-width:800px and min-height:800px),
// (max-height:560px, max-width:300px), (prefers-reduced-motion:reduce).
// The plan's `rules.indexOf('@media (max-height')` is ambiguous now — two of
// the four queries start with that exact prefix — so it would silently key
// off whichever one happens to come first textually rather than the one the
// assertions are actually about. Fixed by anchoring on each query's full,
// unique condition text instead of a shared prefix, and by checking EVERY
// media query in the file against the specific same-specificity selector(s)
// it overrides (not just the first one), because the underlying bug — a
// media rule sitting before the base rule it overrides is a silent no-op at
// equal specificity — is a property of the whole sheet, not one query. This
// project has shipped exactly that bug twice already.
test('invariant 5: every media query overrides rules that precede it in source order', () => {
  const mqShort  = rules.indexOf('@media (max-height: 600px)');
  const mqWide   = rules.indexOf('@media (min-width: 800px) and (min-height: 800px)');
  const mqFloor  = rules.indexOf('@media (max-height: 560px), (max-width: 300px)');
  const mqMotion = rules.indexOf('@media (prefers-reduced-motion: reduce)');

  for (const [name, idx] of [
    ['short-viewport', mqShort],
    ['wide-tall highlight enhancement', mqWide],
    ['bullet floor', mqFloor],
    ['reduced-motion', mqMotion],
  ]) {
    assert.ok(idx > -1, `${name} media query missing`);
  }

  // Short-viewport query overrides .role/.roles/.org (identity survives first).
  for (const sel of ['.role', '.roles', '.org']) {
    const base = rules.lastIndexOf(`${sel} {`, mqShort);
    assert.ok(base > -1 && base < mqShort,
      `${sel} base rule must precede the short-viewport query or the override silently does nothing`);
  }

  // Wide-tall enhancement flips the highlight cap back on — must follow the
  // unconditional base cap rule it overrides (same selector, equal specificity).
  const capBase = rules.indexOf('.card__inner li:nth-child(n+2) {');
  assert.ok(capBase > -1 && capBase < mqWide,
    'the base highlight-cap rule must precede the wide-tall enhancement or it silently does nothing');

  // Reduced-motion un-stickies .card and disables .card__inner's animation —
  // both same-specificity selectors it must come after.
  for (const sel of ['.card__inner', '.card']) {
    const base = rules.lastIndexOf(`${sel} {`, mqMotion);
    assert.ok(base > -1 && base < mqMotion,
      `${sel} base rule must precede the reduced-motion query or the override silently does nothing`);
  }

  // Pin the queries' relative order too, so a future reshuffle can't
  // reintroduce the bug this test exists to catch without tripping it.
  assert.ok(mqShort < mqWide && mqWide < mqFloor && mqFloor < mqMotion,
    'media queries must stay in source order relative to each other');
});

// ADAPTED: the plan's literal `class="deck"` assumes .deck is the sole class
// on the element. In the shipped markup the deck container is `class="wrap
// deck"` (it doubles as the page's .wrap gutter), so that exact string never
// appears. Matched the same way test/html.test.mjs already does — allowing
// other classes alongside deck — rather than requiring an exact attribute.
test('the deck still knows nothing about its own size', () => {
  assert.doesNotMatch(rules, /--count\s*:/);
  assert.match(html, /class="[^"]*\bdeck\b[^"]*"[^>]*--count:/);
});
