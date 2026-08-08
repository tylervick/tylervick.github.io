# tylervick.com Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `resume.json` the single source of truth for tylervick.com, generating a static `index.html` that renders work history as a cascading-scroll card deck plus matching schema.org JSON-LD.

**Architecture:** A dependency-free Node script reads `resume.json`, groups roles by employer, and renders both the visible HTML and the structured data from that one source. Output is committed; visitors get static HTML with no runtime JS for content. CSS is hand-written in `style.css`; all deck-size data (`--count`, `--i`) is emitted inline by the generator so the stylesheet never needs editing when a job is added.

**Tech Stack:** Node 25 (ESM), `node:test` + `node:assert` for tests, no third-party dependencies, no `package.json` dependency block, no `node_modules`.

**Spec:** `docs/superpowers/specs/2026-08-07-site-redesign-design.md`

## Global Constraints

- **Zero dependencies.** No npm installs. Only Node built-ins (`node:fs`, `node:path`, `node:test`, `node:assert`).
- **Run tests with:** `node --test`
- **Run the build with:** `node build.mjs`
- **Generated output is committed.** `index.html` is a build artifact that lives in git.
- **No runtime JS for content.** The only script on the page is the existing clock.
- **System fonts only.** No web fonts, no font files.
- **JSON-LD must describe only content rendered at every viewport.** Highlights are CSS-hidden on short viewports, so highlights are never emitted as structured data.
- **The five CSS invariants** (from the spec) are load-bearing. Task 6 guards them with tests:
  1. `position: sticky` on `.card` (wrapper), never `.card__inner`
  2. `.card__inner` uses `height`, never `min-height`
  3. The runway is a real element, never `padding-bottom` on `.deck`
  4. `svh` only — `dvh` must never appear
  5. The `max-height` media query must come after the base rules it overrides
- **Deck size lives only in `resume.json`.** The generator emits `style="--count:N"` on `.deck` and `style="--i:N"` on each `.card`. `style.css` must contain no `--count` declaration and no `.card:nth-child()` rules.

## File Structure

| File | Responsibility |
| --- | --- |
| `resume.json` | Source of truth. JSON Resume schema v1.2.1. |
| `build/resume.mjs` | Data layer: load, group roles by employer, format date ranges. |
| `build/brands.mjs` | Presentation map: employer name → card slug, header label, display name. |
| `build/jsonld.mjs` | schema.org `@graph` from resume data. |
| `build/html.mjs` | Renders the page: head, intro, deck, footer. |
| `build.mjs` | Entry point. Reads, renders, writes `index.html`. |
| `style.css` | Hand-written. Deck mechanics + visual system. Not generated. |
| `index.html` | **Generated.** Committed. |
| `test/*.test.mjs` | Tests. |

**Not automated:** the deck geometry audit (card overtakes, pinned-bottom spread, fit) requires a real browser and would need a dependency. It stays a manual verification procedure, documented in Task 7.

---

### Task 1: Make `resume.json` canonical and correct

**Files:**
- Create: `resume.json` (from the `resume` branch, with corrections)
- Test: `test/resume-content.test.mjs`

**Interfaces:**
- Consumes: nothing
- Produces: `resume.json` at repo root with 8 work entries across 6 employers, JSON Resume schema v1.2.1

- [ ] **Step 1: Copy resume.json from the `resume` branch**

```bash
git show resume:resume.json > resume.json
```

- [ ] **Step 2: Write the failing content test**

Create `test/resume-content.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const resume = JSON.parse(readFileSync(new URL('../resume.json', import.meta.url)));

test('Function Health is the current role', () => {
  const fn = resume.work.find(w => w.name === 'Function Health');
  assert.ok(fn, 'Function Health missing from work');
  assert.equal(fn.startDate, '2026-06');
  assert.equal(fn.endDate, undefined, 'current role must have no endDate');
  assert.equal(fn.position, 'Software Engineer');
});

test('Disney is closed out', () => {
  const d = resume.work.find(w => w.name === 'The Walt Disney Studios');
  assert.equal(d.endDate, '2026-06');
});

test('exactly one role is current', () => {
  const current = resume.work.filter(w => !w.endDate);
  assert.equal(current.length, 1);
  assert.equal(current[0].name, 'Function Health');
});

test('location is Berkeley', () => {
  assert.equal(resume.basics.location.city, 'Berkeley');
  assert.equal(resume.basics.location.region, 'CA');
});

test('summary does not hard-code a year count', () => {
  assert.doesNotMatch(
    resume.basics.summary,
    /\d+\+?\s*years/i,
    'a hard-coded year count goes stale — describe the work instead',
  );
});

test('every work entry has name, position and startDate', () => {
  for (const w of resume.work) {
    assert.ok(w.name, 'missing name');
    assert.ok(w.position, `missing position for ${w.name}`);
    assert.match(w.startDate, /^\d{4}-\d{2}$/, `bad startDate for ${w.name}`);
  }
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/resume-content.test.mjs`
Expected: FAIL — Function Health missing, Disney has no endDate, location is Boise, summary says "over 8 years".

- [ ] **Step 4: Add Function Health as the first work entry**

In `resume.json`, insert at the **start** of the `work` array:

```json
{
  "name": "Function Health",
  "position": "Software Engineer",
  "url": "https://www.functionhealth.com/",
  "startDate": "2026-06",
  "summary": "Developer experience, infrastructure, and platform engineering.",
  "highlights": [],
  "location": "Berkeley, CA"
}
```

Note: `highlights` is intentionally empty. Do not invent accomplishments.

- [ ] **Step 5: Close out Disney and fix the location**

In the Disney entry, add `"endDate": "2026-06"`.

In `basics.location`, replace the Boise values with:

```json
"location": {
  "countryCode": "US",
  "city": "Berkeley",
  "region": "CA"
}
```

- [ ] **Step 6: Reword the summary so it cannot go stale**

Replace `basics.summary` with:

```
Staff software engineer specializing in developer tooling and platform engineering. Full-stack across Swift, TypeScript and Go, building the test platforms, build systems and infrastructure other engineers ship on.
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `node --test test/resume-content.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 8: Verify the JSON is well-formed and count entries**

Run:
```bash
node -e "const r=require('./resume.json'); console.log('work:',r.work.length,'employers:',new Set(r.work.map(w=>w.name)).size)"
```
Expected: `work: 8 employers: 6`

- [ ] **Step 9: Commit**

```bash
git add resume.json test/resume-content.test.mjs
git commit -m "resume.json becomes canonical, add function health, close disney"
```

---

### Task 2: Data layer — group roles by employer

**Files:**
- Create: `build/resume.mjs`
- Test: `test/resume.test.mjs`

**Interfaces:**
- Consumes: `resume.json` from Task 1
- Produces:
  - `formatRange(start, end) -> string`
  - `groupByEmployer(work) -> Array<{name, url, roles, startDate, endDate, highlights}>` where `roles` is `Array<{position, startDate, endDate, highlights}>`, sorted most-recent-first, and groups are sorted most-recent-first by `startDate`

- [ ] **Step 1: Write the failing test for `formatRange`**

Create `test/resume.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/resume.test.mjs`
Expected: FAIL — `Cannot find module '../build/resume.mjs'`

- [ ] **Step 3: Implement `formatRange`**

Create `build/resume.mjs`:

```js
/** Year-only display range. '2024-05' + '2026-06' -> '2024—26'. */
export function formatRange(start, end) {
  const year = s => (s ? s.slice(0, 4) : null);
  const s = year(start);
  const e = year(end);
  if (!s) return '';
  if (!e) return `${s}—`;
  if (s === e) return s;
  return `${s}—${e.slice(2)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/resume.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing test for `groupByEmployer`**

Append to `test/resume.test.mjs`:

```js
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
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `node --test test/resume.test.mjs`
Expected: FAIL — `groupByEmployer is not a function`

- [ ] **Step 7: Implement `groupByEmployer`**

Append to `build/resume.mjs`:

```js
/**
 * Collapse the flat work list into one entry per employer, so an employer with
 * several roles (Snap) becomes a single card with its titles nested inside.
 */
export function groupByEmployer(work) {
  const byName = new Map();
  for (const w of work) {
    if (!byName.has(w.name)) {
      byName.set(w.name, { name: w.name, url: w.url, roles: [] });
    }
    byName.get(w.name).roles.push({
      position: w.position,
      startDate: w.startDate,
      endDate: w.endDate,
      highlights: w.highlights ?? [],
    });
  }

  const groups = [...byName.values()].map(g => {
    g.roles.sort((a, b) => b.startDate.localeCompare(a.startDate));
    g.startDate = g.roles.at(-1).startDate;
    // any still-open role makes the whole employer current
    g.endDate = g.roles.some(r => !r.endDate) ? undefined : g.roles[0].endDate;
    g.highlights = g.roles.flatMap(r => r.highlights);
    return g;
  });

  groups.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return groups;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `node --test test/resume.test.mjs`
Expected: PASS (9 tests)

- [ ] **Step 9: Commit**

```bash
git add build/resume.mjs test/resume.test.mjs
git commit -m "group work history by employer"
```

---

### Task 3: Brand map

**Files:**
- Create: `build/brands.mjs`
- Test: `test/brands.test.mjs`

**Interfaces:**
- Consumes: employer names from `resume.json`
- Produces: `BRANDS` — an object keyed by the exact `resume.json` employer name, each value `{ slug, label, display }`. `slug` is the CSS class, `label` is the short header-strip name, `display` is the card title.

- [ ] **Step 1: Write the failing test**

Create `test/brands.test.mjs`:

```js
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
```

The first test is the one that matters: it fails the moment a job is added without a card colour, which is exactly the mistake this file exists to prevent.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/brands.test.mjs`
Expected: FAIL — `Cannot find module '../build/brands.mjs'`

- [ ] **Step 3: Implement the brand map**

Create `build/brands.mjs`:

```js
/**
 * Presentation-only mapping from the employer names in resume.json to how they
 * appear on a card. This is deliberately NOT in resume.json — the resume is
 * portable data, this is site styling.
 *
 * Colours live in style.css under the matching slug.
 */
export const BRANDS = {
  'Function Health': { slug: 'b-fn', label: 'Function Health', display: 'Function Health' },
  'The Walt Disney Studios': { slug: 'b-twds', label: 'Disney', display: 'The Walt Disney Studios' },
  'Kagi Inc.': { slug: 'b-kagi', label: 'Kagi', display: 'Kagi Inc.' },
  'Snap Inc.': { slug: 'b-snap', label: 'Snap', display: 'Snap Inc.' },
  'Epic Systems Corporation': { slug: 'b-epic', label: 'Epic', display: 'Epic Systems' },
  'Wegmans Food Markets, Inc.': { slug: 'b-weg', label: 'Wegmans', display: 'Wegmans' },
  'Rochester Institute of Technology': { slug: 'b-rit', label: 'RIT', display: 'Rochester Institute of Technology' },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/brands.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add build/brands.mjs test/brands.test.mjs
git commit -m "brand map for employer cards"
```

---

### Task 4: schema.org JSON-LD

**Files:**
- Create: `build/jsonld.mjs`
- Test: `test/jsonld.test.mjs`

**Interfaces:**
- Consumes: `groupByEmployer` from Task 2 (`build/resume.mjs`)
- Produces: `buildJsonLd(resume, groups) -> object` — a `@graph` containing `WebSite`, `ProfilePage` and `Person` nodes

- [ ] **Step 1: Write the failing test**

Create `test/jsonld.test.mjs`:

```js
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

test('address is Berkeley', () => {
  assert.equal(node('Person').address.addressLocality, 'Berkeley');
});

test('highlights are never emitted as structured data', () => {
  // They are CSS-hidden on short viewports, so marking them up would describe
  // content some visitors cannot see.
  const json = JSON.stringify(graph);
  const highlight = resume.work.flatMap(w => w.highlights ?? [])[0];
  assert.ok(highlight, 'fixture problem: resume has no highlights to check');
  assert.ok(!json.includes(highlight), 'highlight text leaked into JSON-LD');
});

test('ProfilePage points at the Person node', () => {
  assert.equal(node('ProfilePage').mainEntity['@id'], node('Person')['@id']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/jsonld.test.mjs`
Expected: FAIL — `Cannot find module '../build/jsonld.mjs'`

- [ ] **Step 3: Implement the JSON-LD builder**

Create `build/jsonld.mjs`:

```js
const SITE = 'https://tylervick.com';

const org = g => {
  const o = { '@type': 'Organization', name: g.name };
  if (g.url) o.url = g.url;
  return o;
};

/**
 * Emits ONLY facts that render at every viewport: employer, role titles, dates,
 * education. Highlights are deliberately excluded — they are CSS-hidden on short
 * viewports, and marking up content a visitor cannot see is penalised.
 */
export function buildJsonLd(resume, groups) {
  const current = groups.find(g => !g.endDate);
  const past = groups.filter(g => g.endDate);
  const schools = resume.education.map(e => ({
    '@type': 'EducationalOrganization',
    name: e.institution,
    ...(e.url ? { url: e.url } : {}),
  }));

  const person = {
    '@type': 'Person',
    '@id': `${SITE}/#person`,
    name: resume.basics.name,
    url: SITE,
    description: resume.basics.summary,
    email: `mailto:${resume.basics.email}`,
    sameAs: resume.basics.profiles.map(p => p.url),
    address: {
      '@type': 'PostalAddress',
      addressLocality: resume.basics.location.city,
      addressRegion: resume.basics.location.region,
      addressCountry: resume.basics.location.countryCode,
    },
    alumniOf: [...past.map(org), ...schools],
  };

  // Both of these describe a CURRENT position, so neither is emitted when
  // there isn't one. Reading current.roles[0] unguarded would throw.
  if (current) {
    person.worksFor = org(current);
    person.hasOccupation = { '@type': 'Occupation', name: current.roles[0].position };
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: resume.basics.name },
      {
        '@type': 'ProfilePage',
        '@id': `${SITE}/#webpage`,
        url: `${SITE}/`,
        mainEntity: { '@id': person['@id'] },
      },
      person,
    ],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/jsonld.test.mjs`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add build/jsonld.mjs test/jsonld.test.mjs
git commit -m "schema.org json-ld from resume data"
```

---

### Task 5: HTML rendering

**Files:**
- Create: `build/html.mjs`
- Test: `test/html.test.mjs`

**Interfaces:**
- Consumes: `groupByEmployer`, `formatRange` (Task 2), `BRANDS` (Task 3), `buildJsonLd` (Task 4)
- Produces: `renderPage(resume) -> string` — the complete `index.html` document

- [ ] **Step 1: Write the failing test**

Create `test/html.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage } from '../build/html.mjs';

const resume = JSON.parse(readFileSync(new URL('../resume.json', import.meta.url)));
const html = renderPage(resume);

test('renders a complete document', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<\/html>\s*$/);
  assert.match(html, /<link rel="stylesheet" href="style\.css"/);
});

test('deck declares its size inline, not in CSS', () => {
  assert.match(html, /class="deck"[^>]*style="--count:7"/);
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/html.test.mjs`
Expected: FAIL — `Cannot find module '../build/html.mjs'`

- [ ] **Step 3: Implement the renderer**

Create `build/html.mjs`:

```js
import { groupByEmployer, formatRange } from './resume.mjs';
import { BRANDS } from './brands.mjs';
import { buildJsonLd } from './jsonld.mjs';

const esc = s =>
  String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const pad = n => String(n + 1).padStart(2, '0');

function renderRole(r) {
  return `        <div class="role"><span>${esc(r.position)}</span><span class="d">${esc(
    formatRange(r.startDate, r.endDate),
  )}</span></div>`;
}

function renderCard(card, i) {
  const brand = BRANDS[card.name];
  const roles = card.roles.map(renderRole).join('\n');
  const bullets = card.highlights.length
    ? `\n        <ul>\n${card.highlights
        .map(h => `          <li>${esc(h)}</li>`)
        .join('\n')}\n        </ul>`
    : '';
  return `  <div class="card" style="--i:${i}">
    <div class="card__inner ${brand.slug}">
      <div class="hd"><span>${pad(i)} — ${esc(brand.label)}</span><span>${esc(
        formatRange(card.startDate, card.endDate),
      )}</span></div>
      <div class="bd">
        <div class="org">${esc(brand.display)}</div>
        <div class="roles">
${roles}
        </div>${bullets}
      </div>
    </div>
  </div>`;
}

export function renderPage(resume) {
  const groups = groupByEmployer(resume.work);

  // education becomes the final card, in the same deck
  const schools = resume.education.map(e => ({
    name: e.institution,
    roles: [
      {
        position: `${e.studyType}, ${e.area}`,
        startDate: e.startDate,
        endDate: e.endDate,
      },
    ],
    startDate: e.startDate,
    endDate: e.endDate,
    highlights: [],
  }));

  const cards = [...groups, ...schools];
  const graph = buildJsonLd(resume, groups);
  const { name, summary, profiles, email } = resume.basics;
  const mail = `mailto:${email}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(name)} — Software Engineer</title>
<meta name="description" content="${esc(summary)}">
<link rel="manifest" href="site.webmanifest">
<link rel="apple-touch-icon" href="img/icon.png">
<meta property="og:title" content="${esc(name)} — Software Engineer">
<meta property="og:description" content="${esc(summary)}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://tylervick.com">
<meta property="og:image" content="https://tylervick.com/img/tile.png">
<link rel="stylesheet" href="style.css">
<script type="application/ld+json">
${JSON.stringify(graph, null, 2)}
</script>
</head>
<body>
<div class="wrap">
  <header class="intro">
    <span class="kick">${esc(name)}</span>
    <h1>I make software easier to<br>build, test, and&nbsp;ship.</h1>
    <p class="sub">${esc(summary)}</p>
  </header>
</div>

<div class="wrap deck" style="--count:${cards.length}">

${cards.map(renderCard).join('\n\n')}

  <div class="runway" aria-hidden="true"></div>

</div>

<div class="wrap after">
  <h2>Elsewhere</h2>
  <p class="elsewhere">
    <a href="${mail}">Email</a>
${profiles.map(p => `    <a href="${esc(p.url)}">${esc(p.network)}</a>`).join('\n')}
  </p>
  <p class="fine">Berkeley <span class="clock" id="clock"></span> · 2026</p>
</div>
<script>
  const el = document.getElementById("clock");
  const tick = () => el.textContent = new Intl.DateTimeFormat("en-US",
    { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).format(new Date());
  tick(); setInterval(tick, 30000);
</script>
</body>
</html>
`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/html.test.mjs`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add build/html.mjs test/html.test.mjs
git commit -m "render the page from resume data"
```

---

### Task 6: Build entry, stylesheet, and generated output

**Files:**
- Create: `build.mjs`
- Modify: `style.css` (replace wholesale)
- Modify: `index.html` (now generated)
- Modify: `humans.txt`
- Test: `test/build.test.mjs`

**Interfaces:**
- Consumes: `renderPage` (Task 5)
- Produces: `index.html` on disk; `node build.mjs` is the build command

- [ ] **Step 1: Write the build entry point**

Create `build.mjs`:

```js
#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { renderPage } from './build/html.mjs';

const root = new URL('./', import.meta.url);
const resume = JSON.parse(readFileSync(new URL('resume.json', root)));
const out = new URL('index.html', root);

writeFileSync(out, renderPage(resume));
console.log(`wrote ${out.pathname}`);
```

- [ ] **Step 2: Port the stylesheet from the prototype**

Replace `style.css` entirely with the contents of the `<style>` block in `deck-prototype.html`, then make these three changes:

1. **Delete** the `--count: 7;` declaration from `.deck` — the generator now emits it inline.
2. **Delete** the whole `.card:nth-child(N){--i:N-1}` block and its NOTE comment — the generator now emits `--i` inline.
3. **Add** the footer styles the prototype lacked, at the end of the file:

```css
  .elsewhere a { color: var(--ink); text-decoration: underline;
                 text-decoration-color: #cfc6b6; text-underline-offset: .25em; }
  .elsewhere a:hover { color: var(--acc); text-decoration-color: var(--acc); }
  .elsewhere a + a { margin-left: 1rem; }
  .fine { color: var(--muted); margin-top: 2.5rem; font-size: 11.5px; }
  .fine .clock { color: var(--acc); }
```

Keep every comment explaining the deck invariants. They are the reason the mechanics survive future edits.

- [ ] **Step 3: Run the build**

Run: `node build.mjs`
Expected: `wrote /Users/tyler/Documents/pages/index.html`

- [ ] **Step 4: Write the build test**

Create `test/build.test.mjs`:

```js
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
  assert.doesNotMatch(css, /nth-child/, 'card index belongs inline on each .card');
});
```

- [ ] **Step 5: Run the whole suite**

Run: `node --test`
Expected: PASS — all tests across all files.

- [ ] **Step 6: Update the colophon so it stays honest**

In `humans.txt`, replace the technology section with:

```
    Hand-written HTML & CSS, system fonts.
    Generated from resume.json by a dependency-free Node script.
    Three lines of JavaScript for the clock.
    Hosted on Codeberg Pages.
```

- [ ] **Step 7: Verify 404.html still renders**

`404.html` links `/style.css` and uses `.spine`, which the new stylesheet drops. Replace its body with markup the new stylesheet supports:

```html
    <body>
        <div class="wrap">
            <header class="intro">
                <span class="kick">Error 404</span>
                <h1>That page doesn&rsquo;t exist.</h1>
                <p class="sub">The <a href="/">front page</a> does.</p>
            </header>
        </div>
    </body>
```

- [ ] **Step 8: Commit**

```bash
git add build.mjs style.css index.html humans.txt 404.html test/build.test.mjs
git commit -m "generate index.html from resume.json"
```

---

### Task 7: Guard the deck invariants

**Files:**
- Create: `test/invariants.test.mjs`
- Delete: `deck-prototype.html`

**Interfaces:**
- Consumes: `style.css` and `index.html` from Task 6
- Produces: regression tests for the five load-bearing CSS invariants

These invariants were each derived from a real bug. A future tidy-up that "simplifies" any of them silently reintroduces that bug, and none of them fail loudly — they fail as subtle scroll misbehaviour on one device. Hence tests.

- [ ] **Step 1: Write the invariant tests**

Create `test/invariants.test.mjs`:

```js
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

test('invariant 5: the short-viewport query overrides the rules it follows', () => {
  const mq = rules.indexOf('@media (max-height');
  assert.ok(mq > -1, 'short-viewport media query missing');
  for (const sel of ['.role', '.roles', '.org']) {
    const base = rules.lastIndexOf(`${sel} {`, mq);
    assert.ok(base > -1 && base < mq,
      `${sel} base rule must precede the media query or the override silently does nothing`);
  }
});

test('the deck still knows nothing about its own size', () => {
  assert.doesNotMatch(rules, /--count\s*:/);
  assert.match(html, /class="deck"[^>]*--count:/);
});
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `node --test test/invariants.test.mjs`
Expected: PASS (6 tests)

If any fail, the stylesheet port in Task 6 lost an invariant. Fix `style.css` — do not weaken the test.

- [ ] **Step 3: Prove the tests actually bite**

Temporarily change `height: var(--card-h)` to `min-height: var(--card-h)` in `style.css`.

Run: `node --test test/invariants.test.mjs`
Expected: FAIL on invariant 2.

Revert the change and re-run. Expected: PASS. A guard that cannot fail is not a guard.

- [ ] **Step 4: Remove the prototype**

`index.html` now supersedes it, and two copies of the deck will drift.

```bash
git rm deck-prototype.html
```

- [ ] **Step 5: Run the whole suite**

Run: `node --test`
Expected: PASS across all files.

- [ ] **Step 6: Commit**

```bash
git add test/invariants.test.mjs
git commit -m "guard the five deck invariants with tests"
```

---

### Task 8: Manual verification

Not automatable without a browser dependency. Run this before merging to `main`.

- [ ] **Step 1: Serve the site locally**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

- [ ] **Step 2: Run the deck geometry audit**

Paste into the browser console. It sweeps the whole page and asserts the deck never misbehaves:

```js
(() => {
  const cards = [...document.querySelectorAll('.card')];
  const H = document.documentElement.scrollHeight - innerHeight;
  const y0 = scrollY;
  let inversions = 0, worst = 0; const heights = new Set();
  for (let y = 0; y <= H; y += 25) {
    scrollTo(0, y);
    const t = cards.map(c => c.getBoundingClientRect().top);
    heights.add(Math.round(cards[0].querySelector('.card__inner').getBoundingClientRect().height));
    for (let i = 1; i < t.length; i++) {
      const d = t[i - 1] - t[i];
      if (d > 0.5) { inversions++; worst = Math.max(worst, d); }
    }
  }
  const rw = document.querySelector('.runway');
  scrollTo(0, rw.getBoundingClientRect().top + scrollY - innerHeight * 0.9);
  const b = cards.map(c => c.getBoundingClientRect().bottom);
  const spread = Math.max(...b) - Math.min(...b);
  const clipped = cards.filter(c => {
    const el = c.querySelector('.card__inner');
    return el.scrollHeight - Math.round(el.getBoundingClientRect().height) > 1;
  }).length;
  scrollTo(0, y0);
  console.table({ inversions, worstPx: +worst.toFixed(1), bottomSpreadPx: +spread.toFixed(2),
                  distinctHeights: heights.size, clippedCards: clipped });
})();
```

Expected at every viewport: `inversions 0`, `bottomSpreadPx ≤ 0.1`, `distinctHeights 1`, `clippedCards 0`.

- [ ] **Step 3: Check three form factors**

Run the audit at each. Record the numbers.

| | expected |
| --- | --- |
| desktop ~1440×800 | all four metrics clean |
| phone portrait | all four metrics clean |
| phone landscape | all four metrics clean |

- [ ] **Step 4: Verify on a real iOS device**

The audit cannot detect the Safari toolbar bug, because desktop Chrome has no collapsing toolbar. On an actual iPhone:

- Scroll down through the deck, then **back up from the bottom** — card heights must not change.
- Rotate to landscape and repeat.
- Confirm the deck releases as one unit rather than the front card sliding over the stack.

- [ ] **Step 5: Validate the structured data**

Paste the page source into <https://validator.schema.org/>. Expect zero errors, and confirm no highlight text appears in the parsed output.

- [ ] **Step 6: Confirm the build is reproducible**

```bash
node build.mjs && git diff --exit-code index.html && echo "reproducible"
```
Expected: `reproducible` — a clean rebuild changes nothing.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
| --- | --- |
| `resume.json` is the only edited source | 1 |
| Site and resume cannot disagree | 6 (staleness test) |
| Machine-legible page | 4 |
| Cascading deck, smooth everywhere | 6, 7, 8 |
| No runtime dependencies | Global constraints; 5 (script-count test) |
| Group by employer so Snap nests | 2, 5 |
| Only mark up universally rendered content | 4 (highlight-leak test) |
| Five CSS invariants | 7 |
| Content corrections | 1 |
| Brand palette incl. Function Health | 3, 6 |
| Responsive behaviour, fit guard | 6 (CSS port), 8 |
| Deck size is data, not layout config | 5, 6, 7 |
| `humans.txt` honesty | 6 |

**Open questions from the spec that this plan does NOT resolve** — none blocks implementation:

- Kagi's card colour stays `#2f3437`. Resolvable by reading their published tokens, as was done for Function Health.
- The warm Wegmans→RIT run stands.
- Skills and projects are not rendered. `resume.json` retains them; no card type exists yet.
- Landscape shows one highlight per card.

**Type consistency:** `formatRange` and `groupByEmployer` (Task 2) are consumed with those exact names in Tasks 4 and 5. `BRANDS` entries expose `slug`/`label`/`display`, used identically in Task 5. `buildJsonLd(resume, groups)` has the same signature in Tasks 4 and 5. Card objects carry `{name, roles, startDate, endDate, highlights}` in both `groupByEmployer` output and the synthesised education entries in `renderPage`.
