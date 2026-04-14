'use client';

import type { SourceRef } from '@/lib/session-store';

type Props = {
  index: number;
  sources: SourceRef[];
};

export default function InlineCitation({ index, sources }: Props) {
  const source = sources[index - 1];

  if (!source) {
    return (
      <sup
        className='text-ink-quiet px-0.5 cursor-help'
        title='Source not found'
      >
        [{index}]
      </sup>
    );
  }

  function handleClick() {
    const el = document.getElementById(`source-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return (
    <sup
      onClick={handleClick}
      className='text-accent px-0.5 cursor-pointer hover:underline'
      title={source.title}
    >
      [{index}]
    </sup>
  );
}
