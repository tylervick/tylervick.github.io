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
    // any still-open role makes the whole employer current; otherwise the
    // group's end is the latest end across all roles, not just the most
    // recently started one — roles can overlap.
    g.endDate = g.roles.some(r => !r.endDate)
      ? undefined
      : g.roles.reduce((latest, r) => (r.endDate > latest ? r.endDate : latest), g.roles[0].endDate);
    g.highlights = g.roles.flatMap(r => r.highlights);
    return g;
  });

  groups.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return groups;
}
