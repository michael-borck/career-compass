'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import type { StudentProfile } from '@/lib/session-store';

type Props = {
  open: boolean;
  profile: StudentProfile | null;
  trimmed: boolean;
  onAccept: (profile: StudentProfile) => void;
  onRedistill: (guidance: string) => void;
  onCancel: () => void;
};

function ChipList({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
        {label}
      </div>
      <div className='flex flex-wrap gap-2 mb-2'>
        {values.map((v, i) => (
          <span
            key={i}
            className='inline-flex items-center gap-1 border border-border bg-accent-soft rounded-full px-3 py-1 text-[var(--text-sm)]'
          >
            {v}
            <button
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              aria-label={`Remove ${v}`}
            >
              <X className='w-3 h-3' />
            </button>
          </span>
        ))}
      </div>
      <div className='flex gap-2'>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault();
              onChange([...values, draft.trim()]);
              setDraft('');
            }
          }}
          placeholder={`Add ${label.toLowerCase()}…`}
        />
      </div>
    </div>
  );
}

export default function ProfileReviewModal({
  open,
  profile,
  trimmed,
  onAccept,
  onRedistill,
  onCancel,
}: Props) {
  const [local, setLocal] = useState<StudentProfile | null>(profile);
  const [guidance, setGuidance] = useState('');

  // When a fresh profile arrives, reset local copy.
  useEffect(() => {
    setLocal(profile);
    setGuidance('');
  }, [profile]);

  if (!open || !local) return null;

  return (
    <div className='fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4'>
      <div className='bg-paper border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-[var(--text-xl)] font-semibold text-ink'>
            Review your profile
          </h2>
          <button onClick={onCancel} className='text-ink-quiet hover:text-ink'>
            <X className='w-5 h-5' />
          </button>
        </div>

        {trimmed && (
          <div className='mb-4 p-3 border border-accent/30 bg-accent-soft rounded text-[var(--text-sm)] text-ink'>
            Your chat was long, so the profile was built from the most recent
            portion. Edit below to add anything important from earlier.
          </div>
        )}

        <div className='flex flex-col gap-4'>
          <div>
            <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
              Background
            </div>
            <Textarea
              rows={3}
              value={local.background}
              onChange={(e) => setLocal({ ...local, background: e.target.value })}
            />
          </div>
          <ChipList
            label='Interests'
            values={local.interests}
            onChange={(v) => setLocal({ ...local, interests: v })}
          />
          <ChipList
            label='Skills'
            values={local.skills}
            onChange={(v) => setLocal({ ...local, skills: v })}
          />
          <ChipList
            label='Constraints'
            values={local.constraints}
            onChange={(v) => setLocal({ ...local, constraints: v })}
          />
          <ChipList
            label='Goals'
            values={local.goals}
            onChange={(v) => setLocal({ ...local, goals: v })}
          />
        </div>

        <div className='border-t border-border mt-6 pt-4'>
          <div className='text-[var(--text-xs)] font-medium uppercase tracking-[0.18em] text-ink-quiet mb-1'>
            Redistill with guidance (optional)
          </div>
          <Input
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder='e.g., focus on the data analyst thread, ignore teaching'
          />
        </div>

        <div className='flex justify-end gap-2 mt-6'>
          <Button variant='outline' onClick={onCancel}>Cancel</Button>
          <Button
            variant='outline'
            disabled={!guidance.trim()}
            onClick={() => onRedistill(guidance)}
          >
            Redistill
          </Button>
          <Button onClick={() => onAccept(local)}>Accept & generate</Button>
        </div>
      </div>
    </div>
  );
}
