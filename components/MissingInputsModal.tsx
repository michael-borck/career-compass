'use client';

import { useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import LocalFileUpload from '@/components/LocalFileUpload';
import { useSessionStore } from '@/lib/session-store';
import { checkGate, type GatedAction } from '@/lib/action-gate';

type Props = {
  action: GatedAction;
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
};

const ACTION_LABELS: Record<GatedAction, string> = {
  careers: 'Find my careers needs some material to work with. Fill in any one field below.',
  gaps: 'Gap analysis needs a target (job title or job advert) and a profile (resume or about you). One of each is enough.',
  learn: 'Learning path needs a target role. Add a job title or paste a job advert.',
  interview: 'Practice interview needs a target role. Add a job title or paste a job advert.',
  board: 'Board of advisors needs a profile. Upload a resume or write something in About you.',
  compare: 'Compare needs a target role. Add a job title or paste a job advert.',
};

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function MissingInputsModal({ action, open, onClose, onContinue }: Props) {
  const store = useSessionStore();
  const gate = checkGate(action);

  const hasResume = !!store.resumeText;
  const hasFreeText = !!store.freeText.trim();
  const hasJobTitle = !!store.jobTitle.trim();
  const hasJobAdvert = !!store.jobAdvert.trim();

  const showResume = gate.missingProfile && !hasResume;
  const showAboutYou = gate.missingProfile && !hasFreeText;
  const showJobTitle = gate.missingTarget && !hasJobTitle;
  const showJobAdvert = gate.missingTarget && !hasJobAdvert;

  const handleResumeSelect = useCallback(
    async (file: File) => {
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
      } catch (err) {
        console.error(err);
        toast.error('Could not read that file. Try a different format.');
      }
    },
    [store]
  );

  const canContinue = checkGate(action).canProceed;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Before we continue...</DialogTitle>
        </DialogHeader>
        <p className='text-ink-muted text-[var(--text-sm)] mb-4'>{ACTION_LABELS[action]}</p>

        <div className='space-y-4'>
          {showResume && (
            <div>
              <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Resume
              </label>
              <LocalFileUpload
                onFileSelect={handleResumeSelect}
                className='w-full flex items-center justify-center'
              />
              {store.resumeFilename && (
                <p className='text-[var(--text-xs)] text-ink-muted mt-1'>
                  Selected: {store.resumeFilename}
                </p>
              )}
            </div>
          )}

          {showAboutYou && (
            <div>
              <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                About you
              </label>
              <Textarea
                value={store.freeText}
                rows={3}
                onChange={(e) => store.setFreeText(e.target.value)}
                placeholder='A sentence or two about your background, interests, or goals.'
              />
            </div>
          )}

          {showJobTitle && (
            <div>
              <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Job title
              </label>
              <Input
                value={store.jobTitle}
                onChange={(e) => store.setJobTitle(e.target.value)}
                placeholder='e.g. Data analyst, UX researcher'
              />
            </div>
          )}

          {showJobAdvert && (
            <div>
              <label className='block text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
                Job advert
              </label>
              <Textarea
                value={store.jobAdvert}
                rows={3}
                onChange={(e) => store.setJobAdvert(e.target.value)}
                placeholder='Paste a short job listing or description.'
              />
            </div>
          )}
        </div>

        <div className='flex justify-end gap-3 mt-6'>
          <Button variant='outline' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onContinue} disabled={!canContinue}>
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
