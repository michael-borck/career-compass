export type CitationSegment =
  | { kind: 'text'; value: string }
  | { kind: 'cite'; index: number };

export function segmentCitations(text: string): CitationSegment[] {
  if (text.length === 0) return [];
  const regex = /\[(\d+)\]/g;
  const segments: CitationSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ kind: 'text', value: text.slice(lastIndex, match.index) });
    }
    segments.push({ kind: 'cite', index: parseInt(match[1], 10) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: 'text', value: text.slice(lastIndex) });
  }
  return segments;
}

export function hasAnyCitations(text: string): boolean {
  return /\[\d+\]/.test(text);
}
