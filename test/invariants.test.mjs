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
// PROPERTY ACTUALLY CHECKED (re-tightened after a second review round): the
// selectors to check are no longer hand-picked. A hand-picked list drifts —
// round 1 of this test checked .role/.roles/.org/.card/.card__inner/the
// highlight-cap selector because those were the ones this comment happened
// to name, and missed that `li` and `.deck` are ALSO overridden inside the
// short-viewport query (line ~233's `.deck { --peek/--lead }` and line
// ~235's `li { font-size/line-height }`), so a stray unconditional
// duplicate of either would have silently passed. That is precisely the
// failure mode this invariant exists to prevent, reproduced inside the test
// meant to prevent it. Fixed by DERIVING the selector set: every rule
// actually written inside every @media block is parsed out and checked,
// so a future edit that adds a declaration to a media query is covered
// automatically, with nothing to remember to update here.
//
// For each derived selector, this asserts it has EXACTLY ONE unconditional
// (top-level, outside every @media block) rule in the whole file, and that
// occurrence precedes the query. "Exists before" alone is not enough — see
// the round-1 note below — so the count must be exactly 1, not merely >=1;
// a same-specificity duplicate ANYWHERE else in the file (before the query,
// between two queries, or after all of them) makes the count 2 and fails,
// regardless of where the original correctly-placed rule sits. Matching is
// via regex with escaped selector metacharacters and \s+ / \s* for
// whitespace, so `.org{`, `.org  {` and a selector split across a line
// break are all recognized as the same rule a browser would see — the
// round-1 version's `split('${sel} {')` required exactly one literal space
// and would have missed a same-selector duplicate written without one.
//
// SPECIFICITY: a selector derived from inside a media query only needs this
// check if an UNCONDITIONAL rule exists somewhere with the exact same
// selector text — that is the only configuration where source order (and
// therefore a later duplicate) can silently win. A compound/descendant
// selector inside a query that has no identical unconditional counterpart
// (e.g. `.card__inner ul` inside the bullet-floor query, vs. the base rule
// being the plain, lower-specificity `ul { ... }`) is safe regardless of
// source order — CSS specificity decides before order ever gets a vote —
// so no duplicate check applies to it. Today `.card__inner ul` is the only
// selector in this shape; it is named explicitly below rather than silently
// skipped, and the assertion fails loudly if a new, unexplained zero-match
// selector shows up so it gets a human decision instead of a silent pass.
//
// WHAT THIS STILL DOES NOT CATCH:
//  - A same-specificity duplicate placed INSIDE a different, condition-
//    overlapping media query (e.g. a stray `.org` rule inside the
//    (max-height:560px) block, which can be simultaneously true with
//    (max-height:600px)). Every occurrence inside any @media block is
//    treated as conditional and excluded from the unconditional count, so
//    an in-media duplicate is invisible to this check either way. Narrower,
//    second-order case of the same bug class; not exercised by any known
//    regression here.
//  - Selector lists with commas nested inside a pseudo-class, e.g.
//    `:is(.a, .b)` — the extractor splits naively on every comma. Not
//    present in this file today; would mis-parse if introduced.
//  - Rules nested inside a media block (CSS nesting, `@supports` inside
//    `@media`, etc.) — the extractor assumes one flat level of
//    `selector { declarations }` per block, true of all four blocks today.
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

  // Locate every @media block (balanced-brace scan — nothing in this sheet
  // nests a block inside a block further than one level), recording its
  // span so occurrences inside it can be told apart from unconditional ones.
  function findMediaBlocks(text) {
    const blocks = [];
    let i = 0;
    while (true) {
      const at = text.indexOf('@media', i);
      if (at === -1) break;
      const braceStart = text.indexOf('{', at);
      let depth = 1;
      let j = braceStart + 1;
      while (depth > 0 && j < text.length) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      blocks.push({
        condition: text.slice(at, braceStart).trim(),
        start: at,
        end: j, // one past the block's closing brace
        body: text.slice(braceStart + 1, j - 1),
      });
      i = j;
    }
    return blocks;
  }
  const mediaBlocks = findMediaBlocks(rules);
  const isInsideAnyMediaBlock = (idx) => mediaBlocks.some(b => idx >= b.start && idx < b.end);

  // Parse the selector(s) out of every flat `selector { declarations }`
  // rule in a block's body, splitting selector lists on top-level commas.
  function extractSelectors(body) {
    const out = [];
    const re = /([^{}]+)\{[^{}]*\}/g;
    let m;
    while ((m = re.exec(body))) {
      for (const part of m[1].split(',')) {
        const sel = part.trim().replace(/\s+/g, ' ');
        if (sel) out.push(sel);
      }
    }
    return out;
  }

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // Whitespace-flexible: tokens are escaped individually and rejoined with
  // \s+, so internal formatting differences don't defeat the match, and the
  // brace may be preceded by zero or more spaces/newlines.
  function selectorPattern(sel) {
    const tokens = sel.split(' ').filter(Boolean).map(escapeRegExp);
    return new RegExp(tokens.join('\\s+') + '\\s*\\{', 'g');
  }

  // The one selector known today to have no identical unconditional
  // counterpart because it wins on specificity instead of source order —
  // see the SPECIFICITY note above. Anything else with zero unconditional
  // matches is a hard failure, not a silent skip.
  const specificityOnly = new Set(['.card__inner ul']);

  for (const block of mediaBlocks) {
    for (const sel of extractSelectors(block.body)) {
      const matches = [...rules.matchAll(selectorPattern(sel))];
      const unconditional = matches.filter(m => !isInsideAnyMediaBlock(m.index));

      if (unconditional.length === 0) {
        assert.ok(specificityOnly.has(sel),
          `"${sel}" inside "${block.condition}" has no unconditional rule anywhere in the ` +
          `file. If it wins on specificity rather than source order, add it to specificityOnly ` +
          `with a reason; otherwise this selector is likely a typo and silently does nothing`);
        continue;
      }

      assert.equal(unconditional.length, 1,
        `"${sel}" must have exactly one unconditional rule in the file (found ` +
        `${unconditional.length}) — a same-specificity duplicate anywhere wins over the ` +
        `"${block.condition}" query regardless of this query's own position`);
      assert.ok(unconditional[0].index < block.start,
        `"${sel}" base rule must precede "${block.condition}" or the override silently does nothing`);
    }
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
