import { groupByEmployer, formatRange } from './resume.mjs';
import { BRANDS } from './brands.mjs';
import { buildJsonLd } from './jsonld.mjs';

const esc = s =>
  String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * Neutralise HTML-significant characters inside a <script> body. Entity
 * escaping (esc) is WRONG here — a browser does not decode entities inside
 * <script>, so `&amp;` would reach the parser literally. These are JSON-safe
 * \uXXXX escapes instead, so JSON.parse still recovers the exact original
 * string and no substring can close the tag early.
 */
const jsonSafe = s => s.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

const pad = n => String(n + 1).padStart(2, '0');

// Cards in the scroll deck are FIXED-HEIGHT (`height: var(--card-h)` with
// `overflow: hidden` in style.css) — this is load-bearing, because the
// deck's aligned-release scroll mechanic requires every card to be exactly
// the same height. Nothing upstream caps how many highlights an employer
// can accrue (groupByEmployer flat-maps highlights across every role), so
// an uncapped list silently clips inside the box with no visual warning.
//
// 3 is a hard ceiling on whatever reaches the DOM — it is NOT, by itself, a
// viewport-safety guarantee, and two earlier rounds of trying to make it
// one by tuning CSS breakpoints to measured pixels both failed: whether N
// highlights fit is TWO-DIMENSIONAL. --card-h is svh-based, so the box
// height tracks viewport HEIGHT only, while how many lines each <li> wraps
// onto tracks viewport WIDTH — and those two pressures peak at different
// viewports, so a breakpoint tuned on one axis (or even both axes
// separately) reliably leaves a gap at some untested combination of the
// two. Checking one viewport, or a handful, does not prove the general
// case; the constraint is continuous, not discrete.
//
// The actual no-clip guarantee for real viewports comes from this cap of 3
// PLUS the "HIGHLIGHT CAP" rule in style.css, which renders only 1 bullet
// by default (measured safe at 320x568, the smallest viewport checked) and
// reveals all 3 only at (min-width:800px) and (min-height:800px) — a single
// threshold with large, measured margin on both axes, not a chain of
// tuned tiers. See that comment for the full reasoning and measured
// boundary values (728px height is where 3 bullets start overflowing;
// .wrap's 768px max-width is where content width saturates). If you change
// this constant, or add highlights that render very differently in length,
// re-measure with a width AND height matrix (scrollHeight - clientHeight
// on every .card__inner, across viewports spanning both axes) — not by
// eyeballing one window size — and update style.css's threshold too.
export const MAX_CARD_HIGHLIGHTS = 3;

function renderRole(r) {
  return `        <div class="role"><span>${esc(r.position)}</span><span class="d">${esc(
    formatRange(r.startDate, r.endDate),
  )}</span></div>`;
}

function renderCard(card, i) {
  const brand = BRANDS[card.name];
  const roles = card.roles.map(renderRole).join('\n');
  // Highlights are already ordered most-recent-role-first by groupByEmployer;
  // taking the first N keeps the most recent work and must not re-sort.
  const highlights = card.highlights.slice(0, MAX_CARD_HIGHLIGHTS);
  const bullets = highlights.length
    ? `\n        <ul>\n${highlights
        .map(h => `          <li>${esc(h)}</li>`)
        .join('\n')}\n        </ul>`
    : '';
  // role="listitem" (not a real <li>) and <h3 class="org"> (not <div>) are how
  // the deck gets list + heading semantics WITHOUT touching its CSS: style.css
  // has unscoped `ul`/`li` rules for the highlight bullets, and a real <li>
  // here would inherit `position: relative` from them and kill the sticky
  // mechanic outright. The ARIA role conveys the same thing to a screen reader
  // and is invisible to layout. `.org` keeps its class, so an <h3> renders
  // byte-identically to the <div> it replaces (font-size/weight/line-height are
  // all set explicitly and `* { margin:0 }` clears the UA heading margin).
  return `  <div class="card" style="--i:${i}" role="listitem">
    <div class="card__inner ${brand.slug}">
      <div class="hd"><span>${pad(i)} · ${esc(brand.label)}</span><span>${esc(
        formatRange(card.startDate, card.endDate),
      )}</span></div>
      <div class="bd">
        <h3 class="org">${esc(brand.display)}</h3>
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
  // JSON.stringify does not escape HTML-significant characters, and this
  // block is embedded verbatim in a <script> tag. Neutralise them as
  // JSON-safe \uXXXX escapes (not HTML entities) so JSON.parse still
  // recovers the exact original string.
  const graphJson = jsonSafe(JSON.stringify(graph, null, 2));
  const { name, summary, profiles, email, location } = resume.basics;
  // esc() on the address too: an email containing & would otherwise emit
  // invalid HTML, and one containing a quote would break out of the attribute.
  const mail = `mailto:${esc(email)}`;
  // City, timezone and year are DERIVED, never typed twice. The JSON-LD reads
  // basics.location for the same facts, so a hard-coded footer would drift from
  // the structured data the moment the resume moved city — the two-sources-of-
  // truth bug this generator exists to remove.
  const { city, timezone } = location;
  const year = new Date().getFullYear();
  const tzJs = jsonSafe(JSON.stringify(timezone));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(name)} · Software Engineer</title>
<meta name="description" content="${esc(summary)}">
<link rel="manifest" href="site.webmanifest">
<link rel="apple-touch-icon" href="img/icon.png">
<meta property="og:title" content="${esc(name)} · Software Engineer">
<meta property="og:description" content="${esc(summary)}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://tylervick.com">
<meta property="og:image" content="https://tylervick.com/img/tile.png">
<link rel="stylesheet" href="style.css">
</head>
<body>
<main>
<div class="wrap">
  <header class="intro">
    <span class="kick">${esc(name)}</span>
    <h1>I make software easier to<br>build, test, and&nbsp;ship.</h1>
    <p class="sub">${esc(summary)}</p>
  </header>
</div>

<!-- The work history needs a landmark and a name, but NOTHING here may alter
     the deck's geometry: .deck is the sticky containing block, so the section
     wraps it from OUTSIDE rather than adding a child, and the heading that
     names it is .vh (position:absolute), contributing zero flow height. -->
<section aria-labelledby="work-title">
  <h2 id="work-title" class="vh">Work history</h2>

  <div class="wrap deck" style="--count:${cards.length}" role="list">

${cards.map(renderCard).join('\n\n')}

    <!-- Must stay a CHILD of .deck: it extends the deck's CONTENT box, which
         is what gives the last sticky card its travel. -->
    <div class="runway" aria-hidden="true"></div>

  </div>
</section>
</main>

<footer class="wrap after">
  <h2>Elsewhere</h2>
  <p class="elsewhere">
    <a href="${mail}">Email</a>
${profiles.map(p => `    <a href="${esc(p.url)}">${esc(p.network)}</a>`).join('\n')}
  </p>
  <p class="fine">${esc(city)} <span class="clock" id="clock"></span> · ${year}</p>
</footer>
<script>
  const el = document.getElementById("clock");
  const tick = () => el.textContent = new Intl.DateTimeFormat("en-US",
    { hour: "numeric", minute: "2-digit", timeZone: ${tzJs} }).format(new Date());
  tick(); setInterval(tick, 30000);
</script>
<script type="application/ld+json">
${graphJson}
</script>
</body>
</html>
`;
}
