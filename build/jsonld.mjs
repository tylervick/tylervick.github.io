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
