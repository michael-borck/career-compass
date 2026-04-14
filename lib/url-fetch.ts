import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export type FetchResult = {
  text: string;
  title: string;
  domain: string;
};

export type UrlFetchErrorCode =
  | 'invalid'
  | 'timeout'
  | 'linkedin-blocked'
  | 'network'
  | 'no-content';

export class UrlFetchError extends Error {
  constructor(message: string, public code: UrlFetchErrorCode) {
    super(message);
    this.name = 'UrlFetchError';
  }
}

const TIMEOUT_MS = 10000;
const MAX_BYTES = 2_000_000;

export async function fetchAndExtract(rawUrl: string): Promise<FetchResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlFetchError('Invalid URL', 'invalid');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlFetchError('URL must use http or https', 'invalid');
  }

  // LinkedIn profile pages aggressively block non-logged-in fetches.
  if (
    url.hostname.includes('linkedin.com') &&
    url.pathname.includes('/in/')
  ) {
    throw new UrlFetchError(
      'LinkedIn profiles require being logged in. Copy your profile text and paste it into "About you" manually.',
      'linkedin-blocked'
    );
  }

  let response: Response;
  try {
    response = await fetch(rawUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new UrlFetchError('The page took too long to respond.', 'timeout');
    }
    throw new UrlFetchError(
      `Could not fetch the URL: ${err?.message ?? 'unknown error'}`,
      'network'
    );
  }

  if (!response.ok) {
    throw new UrlFetchError(
      `The page returned ${response.status} ${response.statusText}.`,
      'network'
    );
  }

  const html = await response.text();
  if (html.length > MAX_BYTES) {
    throw new UrlFetchError('Page too large to extract', 'no-content');
  }

  const dom = new JSDOM(html, { url: rawUrl });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent || article.textContent.trim().length < 100) {
    throw new UrlFetchError(
      'Could not extract meaningful text from the page. Try copying the content manually.',
      'no-content'
    );
  }

  return {
    text: article.textContent.trim(),
    title: article.title ?? url.hostname,
    domain: url.hostname.replace(/^www\./, ''),
  };
}
