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
  // JSON.stringify does not escape HTML-significant characters, and this
  // block is embedded verbatim in a <script> tag. Neutralise them as
  // JSON-safe \uXXXX escapes (not HTML entities) so JSON.parse still
  // recovers the exact original string.
  const graphJson = JSON.stringify(graph, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
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
</head>
<body>
<div class="wrap">
  <header class="intro">
    <span class="kick">${esc(name)}</span>
    <h1>I make software easier to<br>build, test, and&nbsp;ship.</h1>
    <p class="sub">${esc(summary)}</p>
  </header>
</div>

<div class="deck" style="--count:${cards.length}">

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
<script type="application/ld+json">
${graphJson}
</script>
</body>
</html>
`;
}
