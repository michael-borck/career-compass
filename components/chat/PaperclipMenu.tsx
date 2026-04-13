'use client';

import { useState } from 'react';
import { FileText, Type, Briefcase, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { fileToArrayBuffer } from '@/lib/utils';
import { useSessionStore } from '@/lib/session-store';

type Props = { open: boolean; onClose: () => void };

type Mode = 'menu' | 'text' | 'title';

export default function PaperclipMenu({ open, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('menu');
  const [textValue, setTextValue] = useState('');
  const [titleValue, setTitleValue] = useState('');
  const store = useSessionStore();

  if (!open) return null;

  function close() {
    setMode('menu');
    setTextValue('');
    setTitleValue('');
    onClose();
  }

  async function handleResume() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.md,.docx,.doc';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const ab = await fileToArrayBuffer(file);
        const res = await fetch('/api/parsePdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: Array.from(new Uint8Array(ab)),
            filename: file.name,
          }),
        });
        if (!res.ok) throw new Error('Parse failed');
        const text = await res.json();
        store.setResume(text, file.name);
        store.addChatMessage({
          role: 'system',
          kind: 'attachment-summary',
          content: `Attached resume: ${file.name} (${text.length} chars)`,
        });
        close();
      } catch (err) {
        console.error(err);
        toast.error('Could not parse that file.');
      }
    };
    input.click();
  }

  function submitText() {
    const t = textValue.trim();
    if (!t) return;
    store.addChatMessage({ role: 'user', content: t });
    store.setFreeText(t);
    close();
  }

  function submitTitle() {
    const t = titleValue.trim();
    if (!t) return;
    store.setJobTitle(t);
    store.addChatMessage({
      role: 'user',
      content: `I'm curious about becoming a ${t}.`,
    });
    close();
  }

  return (
    <div className='fixed inset-0 bg-ink/40 flex items-end md:items-center justify-center z-50'>
      <div className='bg-paper border border-border rounded-lg p-6 w-full max-w-md m-4'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-[var(--text-lg)] font-semibold text-ink'>
            Add context
          </h2>
          <button onClick={close} className='text-ink-quiet hover:text-ink'>
            <X className='w-5 h-5' />
          </button>
        </div>

        {mode === 'menu' && (
          <div className='flex flex-col gap-2'>
            <Button variant='outline' onClick={handleResume} className='justify-start'>
              <FileText className='w-4 h-4 mr-2' /> Attach resume file
            </Button>
            <Button variant='outline' onClick={() => setMode('text')} className='justify-start'>
              <Type className='w-4 h-4 mr-2' /> Paste text
            </Button>
            <Button variant='outline' onClick={() => setMode('title')} className='justify-start'>
              <Briefcase className='w-4 h-4 mr-2' /> Add job title
            </Button>
          </div>
        )}

        {mode === 'text' && (
          <div className='flex flex-col gap-3'>
            <Textarea
              rows={5}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder='Paste anything — a description, a transcript, notes…'
            />
            <div className='flex justify-end gap-2'>
              <Button variant='outline' onClick={() => setMode('menu')}>Back</Button>
              <Button onClick={submitText} disabled={!textValue.trim()}>Add</Button>
            </div>
          </div>
        )}

        {mode === 'title' && (
          <div className='flex flex-col gap-3'>
            <Input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              placeholder='e.g., Data Analyst'
            />
            <div className='flex justify-end gap-2'>
              <Button variant='outline' onClick={() => setMode('menu')}>Back</Button>
              <Button onClick={submitTitle} disabled={!titleValue.trim()}>Add</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
