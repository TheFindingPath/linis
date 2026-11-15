export const MODES = Object.freeze({
  all: {name: 'All useful information', hint: 'Keep useful page content and its original evidence.', goal: 'Extract all useful information from this page, preserving facts and details.'},
  facts: {name: 'Key facts', hint: 'Find concrete claims, findings, names, dates, and figures.', goal: 'Select the most informative evidence blocks: main findings, concrete factual claims, names, dates, quantities and conclusions. Skip general introductions, repetition, marketing filler and unrelated detail. Preserve the original evidence; do not generate a summary.'},
  contacts: {name: 'People & contacts', hint: 'Find names and professional titles, with or without contact details.', goal: 'Select relevant people, author names, professional titles and organizations, even without an email address or phone number. Keep their identifying context, and include available email addresses, phone numbers, locations and official contact pages. Skip unrelated content that does not identify a relevant person or organization.'},
  comments: {name: 'Posts & comments', hint: 'Keep posts, comments, author names, titles, and reply context together.', goal: 'Extract posts, comments, discussions and reviews with their observed author names, titles and reply context. Preserve who said what. A name or title belongs with the associated text; do not discard it as an isolated fragment. Skip navigation, action buttons, advertising and page instructions.'},
  data: {name: 'Prices & specifications', hint: 'Find prices, plans, measurements, product details, and availability.', goal: 'Select prices, currencies, plans, product names, specifications, measurements, availability, dates and comparison data, including table headings needed to interpret values. Skip unrelated narrative, navigation and marketing filler.'},
  sources: {name: 'Sources & citations', hint: 'Find references, bibliography entries, citations, and useful source links.', goal: 'Select bibliography entries, references, citations, authors, source titles, DOI links, linked resources and surrounding descriptions that identify useful sources. Skip unrelated body text and site navigation. Preserve source attribution and URLs.'}
});

export function composeGoal(mode, focus = '') {
  if (!Object.hasOwn(MODES, mode)) throw new Error('Select a valid extraction mode.');
  const extra = focus.trim();
  return `${MODES[mode].goal}${extra ? `\nAdditional focus: ${extra}` : ''}`;
}
