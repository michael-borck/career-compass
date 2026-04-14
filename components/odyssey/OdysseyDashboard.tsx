'use client';

import type { OdysseyDashboard } from '@/lib/session-store';

type DashboardField = keyof OdysseyDashboard;

type Props = {
  dashboard: OdysseyDashboard;
  onChange?: (field: DashboardField, value: number | null) => void;
  readOnly?: boolean;
};

const ROWS: { field: DashboardField; label: string; tooltip: string }[] = [
  { field: 'resources', label: 'Resources', tooltip: 'Do I have what I\'d need to make this happen?' },
  { field: 'likability', label: 'Likability', tooltip: 'Do I actually like the sound of this?' },
  { field: 'confidence', label: 'Confidence', tooltip: 'Am I confident I could make it work?' },
  { field: 'coherence', label: 'Coherence', tooltip: 'Does it fit who I\'m becoming?' },
];

export default function OdysseyDashboard({ dashboard, onChange, readOnly = false }: Props) {
  function handleClick(field: DashboardField, value: number) {
    if (readOnly || !onChange) return;
    const current = dashboard[field];
    onChange(field, current === value ? null : value);
  }

  return (
    <div className='mt-6 pt-6 border-t border-border'>
      <div className='editorial-rule justify-center mb-4'>
        <span>How does this feel?</span>
      </div>
      <div className='space-y-3'>
        {ROWS.map((row) => {
          const value = dashboard[row.field];
          return (
            <div key={row.field} className='flex items-center gap-3' title={row.tooltip}>
              <div className='w-28 text-[var(--text-sm)] text-ink-muted'>{row.label}</div>
              <div className='flex gap-2'>
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = value !== null && n <= value;
                  return (
                    <button
                      key={n}
                      type='button'
                      disabled={readOnly}
                      onClick={() => handleClick(row.field, n)}
                      aria-label={`${row.label}: ${n} of 5`}
                      className={`w-4 h-4 rounded-full border transition-colors duration-[200ms] ${
                        filled ? 'bg-accent border-accent' : 'bg-transparent border-ink-quiet'
                      } ${readOnly ? 'cursor-default' : 'cursor-pointer hover:border-accent'}`}
                    />
                  );
                })}
              </div>
              <div className='text-[var(--text-xs)] text-ink-quiet italic flex-1'>{row.tooltip}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
