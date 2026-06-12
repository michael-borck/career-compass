'use client';

import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Props = {
  onLookUp: (query: string) => void;
  disabled?: boolean;
};

export default function LookUpButton({ onLookUp, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  function handleSubmit() {
    const trimmed = query.trim();
    if (!trimmed) return;
    onLookUp(trimmed);
    setQuery('');
    setOpen(false);
  }

  if (!open) {
    return (
      <Button
        type='button'
        variant='outline'
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label='Look something up on the web'
        title='Look something up on the web'
      >
        <Search className='w-4 h-4' />
      </Button>
    );
  }

  return (
    <div className='flex items-center gap-2 flex-1'>
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
        }}
        placeholder='What should I look up?'
      />
      <Button type='button' onClick={handleSubmit} disabled={!query.trim()}>
        Search
      </Button>
      <Button
        type='button'
        variant='outline'
        onClick={() => {
          setOpen(false);
          setQuery('');
        }}
        aria-label='Cancel'
      >
        <X className='w-4 h-4' />
      </Button>
    </div>
  );
}
