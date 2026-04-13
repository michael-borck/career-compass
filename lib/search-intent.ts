export type SearchIntent = 'salary' | 'course' | 'company' | 'general';

const INTENT_FILTERS: Record<Exclude<SearchIntent, 'general'>, string[]> = {
  salary: [
    'glassdoor.com',
    'levels.fyi',
    'seek.com.au',
    'indeed.com',
    'payscale.com',
    'linkedin.com/jobs',
  ],
  course: [
    'coursera.org',
    'edx.org',
    'udemy.com',
    'linkedin.com/learning',
    'pluralsight.com',
    'freecodecamp.org',
    'youtube.com',
  ],
  company: [
    'linkedin.com/company',
    'glassdoor.com',
    'crunchbase.com',
    'wikipedia.org',
  ],
};

export function applyIntent(query: string, intent: SearchIntent): string {
  if (intent === 'general') return query;
  const sites = INTENT_FILTERS[intent];
  const siteFilter = sites.map((s) => `site:${s}`).join(' OR ');
  return `${query} (${siteFilter})`;
}
