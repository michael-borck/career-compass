'use client';

import type { Comparison, ComparisonDimension } from '@/lib/session-store';

const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  typicalDay: 'Typical day',
  coreSkills: 'Core skills',
  trainingNeeded: 'Training needed',
  salaryRange: 'Salary range',
  workSetting: 'Work setting',
  whoItSuits: 'Who it suits',
  mainChallenge: 'Main challenge',
};

const DIMENSION_ORDER: ComparisonDimension[] = [
  'typicalDay',
  'coreSkills',
  'trainingNeeded',
  'salaryRange',
  'workSetting',
  'whoItSuits',
  'mainChallenge',
];

type Props = {
  comparison: Comparison;
};

export default function CompareTable({ comparison }: Props) {
  const { roles } = comparison;
  const colsClass =
    roles.length === 2
      ? 'md:grid-cols-[auto_1fr_1fr]'
      : 'md:grid-cols-[auto_1fr_1fr_1fr]';

  return (
    <div className='mt-6'>
      {/* Desktop grid */}
      <div className={`hidden md:grid ${colsClass} border border-border rounded-lg overflow-hidden bg-paper`}>
        <div className='border-b border-border bg-paper-warm p-4'></div>
        {roles.map((role) => (
          <div
            key={role.label}
            className='border-b border-l border-border bg-paper-warm p-4 text-[var(--text-base)] font-semibold text-ink'
          >
            {role.label}
          </div>
        ))}

        {DIMENSION_ORDER.map((dim, i) => (
          <div key={dim} className='contents'>
            <div
              className={`p-4 text-[var(--text-sm)] text-ink-muted font-medium ${
                i < DIMENSION_ORDER.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              {DIMENSION_LABELS[dim]}
            </div>
            {roles.map((role) => (
              <div
                key={role.label + dim}
                className={`p-4 text-ink-muted leading-relaxed border-l border-border ${
                  i < DIMENSION_ORDER.length - 1 ? 'border-b' : ''
                }`}
              >
                {role.cells[dim]}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Mobile stacked cards */}
      <div className='md:hidden space-y-4'>
        {roles.map((role) => (
          <div key={role.label} className='border border-border rounded-lg bg-paper p-5'>
            <h3 className='text-[var(--text-lg)] font-semibold text-ink mb-4'>{role.label}</h3>
            <dl className='space-y-3'>
              {DIMENSION_ORDER.map((dim) => (
                <div key={dim}>
                  <dt className='text-[var(--text-xs)] text-ink-quiet uppercase tracking-wide'>
                    {DIMENSION_LABELS[dim]}
                  </dt>
                  <dd className='text-ink-muted leading-relaxed mt-1'>{role.cells[dim]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
