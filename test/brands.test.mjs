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

// The slug is the ONLY link between build/brands.mjs and style.css: the
// generator prints it as a class on .card__inner, and style.css defines that
// class's --bg/--fg. Nothing else connects them, so a typo on either side is
// silent — renaming b-snap to b-snapp kept the suite at 48/48 while the Snap
// card rendered with no --bg at all: a blank slab of warm paper where a
// yellow card should be, visible only by looking at the page.
test('every brand slug has a colour rule in style.css', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8')
    // Strip comments so a slug merely NAMED in prose cannot satisfy this.
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [name, b] of Object.entries(BRANDS)) {
    // \b after the slug so .b-snap does not match a rule for .b-snapp.
    const rule = new RegExp(`\\.${b.slug}\\b[^{}]*\\{[^}]*--bg\\s*:`);
    assert.match(
      css,
      rule,
      `no ".${b.slug}" rule defining --bg in style.css for ${name} — the card would ` +
        `render with a transparent background`,
    );
  }
});

// The other direction: a colour rule left behind for a slug nothing uses is
// dead weight, and usually the leftover half of a rename.
test('style.css defines no brand colours for unknown slugs', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const known = new Set(Object.values(BRANDS).map(b => b.slug));
  const declared = [...css.matchAll(/\.(b-[a-z0-9-]+)\s*\{/g)].map(m => m[1]);
  for (const slug of new Set(declared)) {
    assert.ok(known.has(slug), `style.css defines ".${slug}" but no brand uses it`);
  }
});
