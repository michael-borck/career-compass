import { describe, it, expect } from 'vitest';
import { isSafeExternalUrl } from './external-urls.js';

describe('isSafeExternalUrl', () => {
  it.each([
    'https://github.com/michael-borck/career-compass',
    'http://example.com/page?q=1',
    'mailto:someone@example.com',
  ])('allows %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(true);
  });

  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'ftp://example.com/x',
    'vscode://open?url=x',
    'smb://server/share',
    'not a url',
    '',
  ])('blocks %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(false);
  });
});
