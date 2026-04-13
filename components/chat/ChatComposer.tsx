'use client';

import { useState, type KeyboardEvent } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  onSend: (text: string) => void;
  onPaperclip?: () => void;
  disabled?: boolean;
};

export default function ChatComposer({ onSend, onPaperclip, disabled }: Props) {
  const [text, setText] = useState('');

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className='border-t border-border px-6 py-4 flex items-end gap-2'>
      {onPaperclip && (
        <Button
          type='button'
          variant='outline'
          onClick={onPaperclip}
          disabled={disabled}
          aria-label='Attach'
        >
          <Paperclip className='w-4 h-4' />
        </Button>
      )}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        rows={2}
        placeholder='Type a message…'
        disabled={disabled}
        className='flex-1 resize-none'
      />
      <Button type='button' onClick={handleSend} disabled={disabled || !text.trim()}>
        <Send className='w-4 h-4' />
      </Button>
    </div>
  );
}
