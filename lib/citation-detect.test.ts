import { describe, it, expect } from 'vitest';
import { segmentCitations, hasAnyCitations } from './citation-detect';

describe('hasAnyCitations', () => {
  it('returns false for plain text', () => {
    expect(hasAnyCitations('no markers here')).toBe(false);
  });

  it('returns true for a single marker', () => {
    expect(hasAnyCitations('salary is $85k [1]')).toBe(true);
  });

  it('returns true for multiple markers', () => {
    expect(hasAnyCitations('[1] and [2] and [3]')).toBe(true);
  });

  it('does NOT match malformed brackets', () => {
    expect(hasAnyCitations('[abc]')).toBe(false);
    expect(hasAnyCitations('[1abc]')).toBe(false);
  });
});

describe('segmentCitations', () => {
  it('returns a single text segment for plain text', () => {
    expect(segmentCitations('hello world')).toEqual([
      { kind: 'text', value: 'hello world' },
    ]);
  });

  it('splits text with one marker', () => {
    expect(segmentCitations('salary is $85k [1] for Perth')).toEqual([
      { kind: 'text', value: 'salary is $85k ' },
      { kind: 'cite', index: 1 },
      { kind: 'text', value: ' for Perth' },
    ]);
  });

  it('splits text with multiple markers', () => {
    expect(segmentCitations('a [1] b [2] c')).toEqual([
      { kind: 'text', value: 'a ' },
      { kind: 'cite', index: 1 },
      { kind: 'text', value: ' b ' },
      { kind: 'cite', index: 2 },
      { kind: 'text', value: ' c' },
    ]);
  });

  it('handles text ending with a marker', () => {
    expect(segmentCitations('salary [1]')).toEqual([
      { kind: 'text', value: 'salary ' },
      { kind: 'cite', index: 1 },
    ]);
  });

  it('handles text starting with a marker', () => {
    expect(segmentCitations('[1] is the source')).toEqual([
      { kind: 'cite', index: 1 },
      { kind: 'text', value: ' is the source' },
    ]);
  });

  it('treats malformed brackets as plain text', () => {
    expect(segmentCitations('hello [abc] world')).toEqual([
      { kind: 'text', value: 'hello [abc] world' },
    ]);
  });

  it('handles empty string', () => {
    expect(segmentCitations('')).toEqual([]);
  });
});
