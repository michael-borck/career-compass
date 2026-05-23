import { describe, it, expect } from 'vitest';
import { parseModelJson, toString, toStringArray, toRecord } from './model-json';

describe('parseModelJson', () => {
  it('parses a plain JSON object', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses a plain JSON array', () => {
    expect(parseModelJson('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('strips a ```json fence', () => {
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('strips a bare ``` fence (no language tag)', () => {
    expect(parseModelJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('tolerates surrounding whitespace and newlines', () => {
    expect(parseModelJson('  \n ```json\n{"a":1}\n```  \n')).toEqual({ a: 1 });
  });

  it('parses a fenced opener with no closing fence', () => {
    // The model sometimes truncates the closing fence; the opener is stripped
    // and the remainder still parses.
    expect(parseModelJson('```json\n{"a":1}')).toEqual({ a: 1 });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseModelJson('not json')).toThrow();
  });

  it('throws on an empty string', () => {
    expect(() => parseModelJson('')).toThrow();
  });
});

describe('toString', () => {
  it('passes a string through', () => {
    expect(toString('hi')).toBe('hi');
  });

  it('falls back to "" for non-strings by default', () => {
    expect(toString(undefined)).toBe('');
    expect(toString(null)).toBe('');
    expect(toString(42)).toBe('');
    expect(toString({})).toBe('');
  });

  it('uses a custom fallback', () => {
    expect(toString(undefined, 'Unknown')).toBe('Unknown');
  });
});

describe('toStringArray', () => {
  it('keeps an array of strings', () => {
    expect(toStringArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('filters out non-string entries', () => {
    expect(toStringArray(['a', 1, null, 'b', {}])).toEqual(['a', 'b']);
  });

  it('returns [] for non-arrays', () => {
    expect(toStringArray(undefined)).toEqual([]);
    expect(toStringArray(null)).toEqual([]);
    expect(toStringArray('a')).toEqual([]);
    expect(toStringArray({ 0: 'a' })).toEqual([]);
  });
});

describe('toRecord', () => {
  it('passes an object through by reference', () => {
    const obj = { a: 1 };
    expect(toRecord(obj)).toBe(obj);
  });

  it('returns {} for null, undefined, and primitives', () => {
    expect(toRecord(null)).toEqual({});
    expect(toRecord(undefined)).toEqual({});
    expect(toRecord('a')).toEqual({});
    expect(toRecord(42)).toEqual({});
  });
});
