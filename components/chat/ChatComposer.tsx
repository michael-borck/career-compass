'use client';

import { useState, type KeyboardEvent } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import LookUpButton from './LookUpButton';

type Props = {
  onSend: (text: string) => void;
  onPaperclip?: () => void;
  onLookUp?: (query: string) => void;
  disabled?: boolean;
  onOdyssey?: () => void;
  odysseyDisabled?: boolean;
  onBoard?: () => void;
  boardDisabled?: boolean;
};

export default function ChatComposer({ onSend, onPaperclip, onLookUp, disabled, onOdyssey, odysseyDisabled, onBoard, boardDisabled }: Props) {
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
    <>
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
        {onLookUp && <LookUpButton onLookUp={onLookUp} disabled={disabled} />}
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
      {(onOdyssey || onBoard) && (
        <div className='px-6 pb-3 flex gap-4'>
          {onOdyssey && (
            <button
              type='button'
              onClick={onOdyssey}
              disabled={odysseyDisabled}
              className='text-[var(--text-sm)] text-ink-muted hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Try as Odyssey plan →
            </button>
          )}
          {onBoard && (
            <button
              type='button'
              onClick={onBoard}
              disabled={boardDisabled}
              className='text-[var(--text-sm)] text-ink-muted hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Try as board review →
            </button>
          )}
        </div>
      )}
    </>
  );
}
