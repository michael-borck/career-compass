'use client';

import { useState } from 'react';
import { Clipboard, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';

type Props = {
  getMarkdown: () => string;
  label?: string;
};

export default function CopyMarkdownButton({ getMarkdown, label = 'Copy as Markdown' }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getMarkdown());
      setCopied(true);
      toast.success('Copied.');
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
      toast.error('Could not copy. Your browser may not allow clipboard access.');
    }
  }

  return (
    <Button variant='outline' onClick={handleCopy}>
      {copied ? <Check className='w-4 h-4 mr-2' /> : <Clipboard className='w-4 h-4 mr-2' />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
