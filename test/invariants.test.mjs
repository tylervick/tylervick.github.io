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
// unique condition text instead of a shared prefix.
//
// PROPERTY ACTUALLY CHECKED (tightened after review): for three of the four
// queries, each selector the query overrides must have EXACTLY ONE
// unconditional (top-level, outside any @media block) rule in the whole
// file, and that rule must sit before the query. "Exists before" alone is
// NOT enough: a base rule earlier in the file plus a same-specificity
// duplicate appended anywhere later (even after every media query) wins in
// every browser and silently cancels the override, and an existence-only
// check can't see that second rule at all. The exactly-one-at-top-level
// count closes that gap: a stray top-level `.org { ... }` appended at the
// end of the file makes the count 2 and fails, regardless of where the
// original correctly-placed rule sits.
// WHAT THIS STILL DOES NOT CATCH: a same-specificity duplicate placed
// inside a *different* media query whose condition can be simultaneously
// true with the one under test (e.g. a stray `.org` rule inside the
// (max-height:560px) block, which overlaps (max-height:600px)). That's a
// narrower, second-order case of the same bug class, not exercised by any
// known regression here — flagged rather than silently unhandled.
test('invariant 5: every media query overrides rules that precede it, with no later duplicate', () => {
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

  // Strip the body of every @media block (balanced-brace scan — nothing in
  // this sheet nests a block inside a block further than one level) to get
  // the TOP-LEVEL stylesheet: only rules that apply unconditionally. Used
  // below to count how many unconditional rules exist for a selector,
  // wherever in the file they sit.
  function stripMediaBlocks(text) {
    let out = '';
    let i = 0;
    while (i < text.length) {
      const at = text.indexOf('@media', i);
      if (at === -1) { out += text.slice(i); break; }
      out += text.slice(i, at);
      const braceStart = text.indexOf('{', at);
      let depth = 1;
      let j = braceStart + 1;
      while (depth > 0 && j < text.length) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      i = j;
    }
    return out;
  }
  const topLevel = stripMediaBlocks(rules);

  function assertSoleUnconditionalRuleBefore(sel, mq, label) {
    const base = rules.lastIndexOf(`${sel} {`, mq);
    assert.ok(base > -1 && base < mq,
      `${sel} base rule must precede the ${label} query or the override silently does nothing`);
    const count = topLevel.split(`${sel} {`).length - 1;
    assert.equal(count, 1,
      `${sel} must have exactly one unconditional rule in the file (found ${count}) — a ` +
      `same-specificity duplicate anywhere, before or after, wins over the ${label} query ` +
      `regardless of this query's own position`);
  }

  // Short-viewport query overrides .role/.roles/.org (identity survives first).
  for (const sel of ['.role', '.roles', '.org']) {
    assertSoleUnconditionalRuleBefore(sel, mqShort, 'short-viewport');
  }

  // Wide-tall enhancement flips the highlight cap back on — must follow the
  // unconditional base cap rule it overrides (same selector, equal
  // specificity). Its own occurrence lives inside the wide-tall @media
  // block itself, so stripMediaBlocks removes it before counting — only
  // the true unconditional cap rule is left, and it must count 1, not 0 or 2.
  assertSoleUnconditionalRuleBefore('.card__inner li:nth-child(n+2)', mqWide, 'wide-tall enhancement');

  // Reduced-motion un-stickies .card and disables .card__inner's animation —
  // both same-specificity selectors it must come after with no later
  // unconditional duplicate.
  for (const sel of ['.card__inner', '.card']) {
    assertSoleUnconditionalRuleBefore(sel, mqMotion, 'reduced-motion');
  }

  // The bullet-floor query targets `.card__inner ul`, a compound selector
  // that outranks the plain `ul { ... }` base rule on specificity alone —
  // source order is irrelevant there, so unlike the other three there is
  // no equal-specificity race to guard and no duplicate-rule check applies.
  // Existence + relative order is the whole of what's checked for it.

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
