# tylervick.com redesign — design

**Date:** 2026-08-07
**Branch:** `redesign` (off `main`)
**Status:** deck mechanics validated in prototype; generator and content work not started

## Problem

`main` is live and clean, but three things are wrong with it.

**Content has drifted.** The site's work history is hand-typed HTML. A structured
`resume.json` exists on the stale `resume` branch, disconnected from the site, and the
two disagree:

| Live site (`main`) | Reality |
| --- | --- |
| 4 work entries | 8 roles across 7 employers |
| Snap as one `2017–2024` block | 3 distinct roles |
| — | **Function Health missing** (current role, from 2026-06) |
| Disney shown as current | ended 2026-06 |
| — | **Kagi Inc. missing entirely** |
| "Studio Technology" | "Staff Software Engineer (Contract)" |
| "QA Engineering" (Wegmans) | "Quality Assurance Intern" |
| RIT "2015" | 2011–2015, "Information Systems & Marketing" |
| — | 7 skill groups + XCTestHTMLReport |

**The structure can't hold the real career.** A flat one-line-per-row timeline collapses
Snap's three roles into one and has nowhere to put contract vs. permanent work.

**No single source of truth.** Content is maintained by hand in two places, so drift is
the default rather than an accident.

## Goals

1. `resume.json` is the only place content is edited.
2. The site and the resume cannot disagree.
3. The page is machine-legible (search engines, AI crawlers).
4. Work history is presented as a cascading-scroll card deck, smooth on every device.
5. No runtime dependencies; visitors still get static HTML.

## Non-goals

- Changing the information architecture. It stays a single page.
- Adding `writing` / `notes` sections. They don't exist and aren't in scope.
- A static-site generator or any dependency tree.
- Rescuing the `cards-native` spike. It is parked as an artifact.

## Architecture

```
resume.json  ──▶  build.mjs  ──▶  index.html
(source of truth)  (Node, no deps)   (semantic HTML + JSON-LD, committed)
```

- **Source format:** JSON Resume schema v1.2.1 — already in the repo's history, a real
  standard, keeps the resume-PDF tooling path open.
- **Generator:** a single Node ESM script, no `package.json` dependencies, no
  `node_modules`. Run by hand: `node build.mjs`. Output is committed.
- **Served artifact:** static HTML. No runtime JS for content, no fetch, no hydration.

### Why a generator rather than the alternatives

JSON Resume and schema.org are not competing choices — they are different layers.
JSON Resume is an *authoring* format that no search engine reads. schema.org JSON-LD is
the *consumption* format that Google's Knowledge Graph and AI search extract entities
from. The page needs both, and Google penalises markup describing content the user
cannot see. Generating the visible HTML and the JSON-LD from one source makes
"they agree" structural rather than a thing someone remembers to check.

Rejected: client-side fetch (breaks no-JS and SEO), hand-written JSON-LD alongside
hand-written HTML (doubles the drift problem), a full SSG (dependency tree).

### Content mapping

| `resume.json` | Page | schema.org |
| --- | --- | --- |
| `basics.name` | header | `Person.name` |
| `basics.summary` | intro paragraph | `Person.description` |
| `basics.profiles[]` | footer links | `Person.sameAs` |
| `work[]` grouped by `name` | one card per employer | `Person.worksFor` / `alumniOf` |
| `work[].position` + dates | role lines inside the card | `OrganizationRole.roleName` |
| `work[].highlights[]` | bullets inside the card | **deliberately not emitted** |
| `education[]` | final card | `Person.alumniOf` |

**Grouping by employer, not by role**, is what lets Snap's three titles nest inside one
card. It solves the structural problem and the visual one at once.

**Only emit JSON-LD for content the page actually renders — to every visitor.**

This has a sharp edge worth stating plainly. The JSON-LD is one static block, but the
rendered content varies by viewport: highlights are CSS-hidden on short viewports. So
"what is rendered" is not a single answer, and marking up CSS-hidden content is exactly
what Google penalises.

**Decision:** highlights are not emitted in JSON-LD at all. Only facts that render at
*every* viewport get marked up — employer, role titles, dates, education. This costs a
little richness and keeps the structured data unambiguously honest.

If highlights are wanted in the structured data later, the fix is to stop CSS-hiding them
(e.g. trim in the generator instead, or shrink type rather than remove content) so the
rendered set is viewport-independent again.

## The deck

Validated in `deck-prototype.html`. The mechanics were established empirically and the
invariants below are load-bearing — each one, when violated, produced a specific
reported bug.

### Structure

```html
<div class="deck">
  <div class="card">            <!-- sticky wrapper: scroll travel + release timing -->
    <div class="card__inner">   <!-- the visible pass: purely visual -->
  </div>
  ...
  <div class="runway">          <!-- real element, gives the last pass travel -->
</div>
```

### Invariants

These are not style preferences. Breaking any one reintroduces a specific failure.

1. **`position: sticky` goes on the wrapper, never on the visible card.**
   One element cannot own both scroll travel and visual height. Conflating them is what
   forced the original's `dvh` height math, per-pass margin hacks, and `--runway`/`--fill`
   tuning knobs — every knob fought another.

2. **Every `.card__inner` must be exactly the same height — `height`, not `min-height`.**
   Aligned release depends on equal heights. `min-height` is only a floor, so
   content-heavy passes (Disney, Snap) grew past it, sat lower, and broke loose from the
   deck early. Content must be trimmed to fit rather than allowed to expand.

3. **The runway must be a real element, not `padding-bottom` on `.deck`.**
   A sticky box is caged by its containing block's *content* box; padding sits outside
   it. Padding grows the deck without granting the last pass any travel — the last card
   then scrolls up over the whole stack instead of pinning.

4. **Viewport units must be `svh`, never `dvh`.**
   `dvh` re-resolves live as Safari's toolbar collapses, so every pass resizes mid-scroll.
   `svh` is the small viewport (toolbar showing): static, no layout recalculation, and
   sizing to it guarantees fit in the worst case.

5. **Short-viewport overrides must appear after the base rules they override.**
   Equal specificity means source order decides. An earlier version of the media query
   sat above those rules and silently did nothing.

### Release alignment

Each wrapper gets `padding-bottom: calc(gap + (count - 1 - i) * peek)`, putting every
pinned bottom on one line so the deck releases as a single unit rather than the front
pass tearing loose and sliding over the stack.

This requires `--count`. That is inherent: simultaneous release is a property of the
whole deck, so a card cannot compute its own release offset without knowing the deck's
size. **Accepted cost:** earlier passes get more scroll travel than later ones. The
padding is transparent and the visible cards stay one size, so it reads as rhythm rather
than as a gap.

### Fit guard

`--card-h: min(58svh, calc(100svh - stack - 5svh))` where
`--stack: lead + (count - 1) * peek`.

The assembled deck must fit one screen or the shared release line lands below the fold.
Landscape phones are the pinch: `--peek` scales with `vw` (growing) while viewport height
shrinks. A `max-height: 600px` query additionally shrinks the cascade itself.

**This is a fit constraint and is deliberately separate from the release alignment**,
which uses no viewport units at all. Keeping them separate is what makes the deck
tunable instead of a balancing act.

### Header band

`.hd { min-height: var(--peek); align-items: center }` with the card's `padding-top: 0`.
The peek band and the header strip are the same thing by construction, so a buried pass
shows its label optically centred at any viewport. Previously the band's height was an
accident of padding plus line-height, which looked even at desktop's 46px peek and went
bottom-tight at the 30px peek the clamp floors to on phones.

## Visual system

- **Ground:** warm paper `#f4f1ea`, ink `#161412`, accent `#ff4f00`.
- **Type:** Iowan Old Style / Palatino / Georgia for display; SF Mono / `ui-monospace`
  for metadata. System fonts only — no web fonts, no font files.
- **Cards:** 24px radius, per-employer brand colour, `color-mix` rules off `currentColor`
  so they read on light and dark backgrounds alike.

Brand palette carried over from the spine in `main`'s `style.css`:

| Employer | Background | Foreground |
| --- | --- | --- |
| Function Health | `#b05a36` | white — their `--orange` token, 4.81:1 (AA) |
| Disney | `hsl(235,64%,38%)` | white — darkened from the spine's `70%,42%` for contrast |
| Kagi | `#2f3437` | white — **placeholder, not a brand colour** |
| Snap | `#fffc00` | `#161412` |
| Epic | `#ba122b` | white |
| Wegmans | `#ea8d1a` | `#2a1c08` |
| RIT | `#f76902` | `#2a1204` |

Light brands flip to dark text rather than being darkened away from the real colour.

## Responsive behaviour

- Fit guard keeps the assembled deck within one screen at every viewport.
- Below `max-height: 600px`: cascade shrinks (`--peek: 1.35rem`, `--lead: 3svh`), and
  content trims to what fits — identity first, so org, titles and dates always survive.
  Currently that means one highlight per card in landscape.
- `prefers-reduced-motion`: the deck degrades to static flow, no sticky, no animation.
- The `bury` depth cue uses `animation-timeline: view()` and is progressive enhancement.

Verified with a full-page sweep every 25px, at 7 cards:

| | landscape 932×357 | desktop 1440×757 |
| --- | --- | --- |
| card overtakes | 0 | 0 |
| pinned-bottom spread | 0.01px | 0.00px |
| clipped content | none | none |
| assembled deck fits | 339 ≤ 357 | 719 ≤ 757 |
| distinct card heights during scroll | 1 (199px) | 1 (395px) |

Adding the 7th card required no tuning: the fit guard absorbed the extra peek by
shrinking every pass from 207px to 199px in landscape. That is the property to protect —
deck size is data, not a layout parameter someone has to rebalance by hand.

## Content corrections

To apply when `resume.json` becomes canonical:

1. **Add Function Health.** Software Engineer, from 2026-06, focused on developer
   experience, infrastructure and platform. Current role — becomes the front card.
   No highlights invented; the card carries the role and focus only until there is
   real material to add.
2. **Close out Disney.** `endDate: 2026-06`. It is no longer the current role.
3. **Location → Berkeley, CA.** `resume.json` says Boise; `main` says San Francisco.
   Neither is right. The `America/Los_Angeles` clock is already correct.
4. Per-role locations are historical and stay as-is.
5. Function Health, Disney, Kagi, Snap ×3, Epic, Wegmans, RIT all appear, grouped by
   employer — 8 roles, 7 cards.
6. Education area is "Information Systems & Marketing", 2011–2015.
7. `basics.summary` says "over 8 years"; it should be derived from the dates or reworded
   so it cannot go stale again.
8. `humans.txt` says "no build step" — update to stay honest once `build.mjs` exists.

## Open questions

1. **Kagi's card colour.** `#2f3437` is a placeholder; Kagi had no colour in the original
   spine palette. Function Health's was resolved by reading their published tokens
   (`--orange: #B05A36`, `--midnight: #2A2B2F`, `--cream: #F5EEE1`); the same approach
   would settle Kagi.
2. **Wegmans → RIT run warm.** `#ea8d1a` and `#f76902` are adjacent and similar, so the
   bottom of the deck reads as three warm cards in a row. Faithful to the brands; may
   want RIT pushed to a darker secondary.
3. **Skills and projects.** `resume.json` has 7 skill groups and XCTestHTMLReport. Not in
   the prototype, and no decision yet on whether they appear.
4. **Landscape trimming.** One highlight per card is a judgement call. The alternative is
   smaller cards holding more prose.

## Verification

- HTML well-formedness check on generated output.
- Deck audit: sweep the page, assert zero card overtakes, zero clipped content, exactly
  one distinct card height, assembled deck ≤ viewport — at landscape, portrait, desktop.
- `resume.json` validates against the JSON Resume schema.
- JSON-LD validates and describes only rendered content.
- Real-device check on iOS Safari, portrait and landscape, including scroll-up.
