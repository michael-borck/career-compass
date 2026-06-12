import { describe, it, expect } from 'vitest';
import { classifyUrl } from './url-classify';

describe('classifyUrl — job adverts', () => {
  it('classifies Seek job URL', () => {
    expect(classifyUrl('https://www.seek.com.au/job/12345')).toBe('jobAdvert');
  });

  it('classifies Indeed job URL', () => {
    expect(classifyUrl('https://au.indeed.com/viewjob?jk=abc')).toBe('jobAdvert');
  });

  it('classifies LinkedIn job URL', () => {
    expect(classifyUrl('https://www.linkedin.com/jobs/view/123')).toBe('jobAdvert');
  });

  it('classifies Glassdoor job URL', () => {
    expect(classifyUrl('https://www.glassdoor.com/job-listing/Job-x')).toBe('jobAdvert');
  });

  it('classifies Workable URL', () => {
    expect(classifyUrl('https://acme.workable.com/j/ABC123')).toBe('jobAdvert');
  });

  it('classifies Greenhouse URL', () => {
    expect(classifyUrl('https://boards.greenhouse.io/acme/jobs/123')).toBe('jobAdvert');
  });

  it('classifies Lever URL', () => {
    expect(classifyUrl('https://jobs.lever.co/acme/abc')).toBe('jobAdvert');
  });
});

describe('classifyUrl — profile/portfolio', () => {
  it('classifies LinkedIn profile URL', () => {
    expect(classifyUrl('https://www.linkedin.com/in/michael-borck/')).toBe('freeText');
  });

  it('classifies GitHub profile URL', () => {
    expect(classifyUrl('https://github.com/michael-borck')).toBe('freeText');
  });

  it('classifies about.me URL', () => {
    expect(classifyUrl('https://about.me/someone')).toBe('freeText');
  });

  it('classifies notion.site URL', () => {
    expect(classifyUrl('https://user.notion.site/page')).toBe('freeText');
  });
});

describe('classifyUrl — unknown and malformed', () => {
  it('returns unknown for a random blog', () => {
    expect(classifyUrl('https://example.com/blog/post')).toBe('unknown');
  });

  it('returns unknown for malformed URL', () => {
    expect(classifyUrl('not a url at all')).toBe('unknown');
  });

  it('returns unknown for empty string', () => {
    expect(classifyUrl('')).toBe('unknown');
  });
});
