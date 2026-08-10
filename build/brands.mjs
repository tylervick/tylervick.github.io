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
  'Snap Inc.': { slug: 'b-snap', label: 'Snap', display: 'Snap Inc.' },
  'Epic Systems Corporation': { slug: 'b-epic', label: 'Epic', display: 'Epic Systems' },
  'Wegmans Food Markets, Inc.': { slug: 'b-weg', label: 'Wegmans', display: 'Wegmans' },
  'Rochester Institute of Technology': { slug: 'b-rit', label: 'RIT', display: 'Rochester Institute of Technology' },
};
