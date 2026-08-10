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
    // NO email here, deliberately. Structured data exists to be machine-read,
    // so an address in this block is the most harvestable copy on the page,
    // strictly easier to scrape than the visible mailto: link. schema.org/email
    // is optional and buys nothing: Google does not need it for a Person or
    // ProfilePage result, so publishing it is pure downside. The visible footer
    // link stays plaintext on purpose (obfuscation is largely defeated now and
    // costs real usability for screen readers and copy-paste); the mitigation
    // is that basics.email is a burnable alias, not a primary address.
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
