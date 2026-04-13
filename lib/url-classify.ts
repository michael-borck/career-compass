export type UrlClassification = 'jobAdvert' | 'freeText' | 'unknown';

type Pattern = {
  classify: UrlClassification;
  match: (hostname: string, path: string) => boolean;
};

const PATTERNS: Pattern[] = [
  // Job postings
  { classify: 'jobAdvert', match: (h) => h.includes('seek.com') },
  { classify: 'jobAdvert', match: (h) => h.includes('indeed.com') },
  {
    classify: 'jobAdvert',
    match: (h, p) => h.includes('linkedin.com') && p.includes('/jobs/'),
  },
  {
    classify: 'jobAdvert',
    match: (h, p) => h.includes('glassdoor.com') && (p.includes('/job') || p.includes('/Job')),
  },
  { classify: 'jobAdvert', match: (h) => h.includes('workable.com') },
  { classify: 'jobAdvert', match: (h) => h.includes('greenhouse.io') },
  { classify: 'jobAdvert', match: (h) => h.includes('lever.co') },
  // Profile / portfolio
  {
    classify: 'freeText',
    match: (h, p) => h.includes('linkedin.com') && p.includes('/in/'),
  },
  { classify: 'freeText', match: (h) => h.includes('github.com') },
  { classify: 'freeText', match: (h) => h.includes('about.me') },
  { classify: 'freeText', match: (h) => h.includes('notion.site') },
  { classify: 'freeText', match: (h) => h.endsWith('.carrd.co') },
];

export function classifyUrl(rawUrl: string): UrlClassification {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    for (const p of PATTERNS) {
      if (p.match(hostname, path)) return p.classify;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
