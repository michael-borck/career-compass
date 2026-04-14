'use client';

import type { OdysseyLife, OdysseyLifeType } from '@/lib/session-store';
import OdysseyElaboration from './OdysseyElaboration';
import OdysseyDashboard from './OdysseyDashboard';

const TITLES: Record<OdysseyLifeType, string> = {
  current: 'Life 1 — Current Path',
  pivot: 'Life 2 — The Pivot',
  wildcard: 'Life 3 — The Wildcard',
};

type Props = {
  lives: Record<OdysseyLifeType, OdysseyLife>;
};

export default function OdysseyCompareView({ lives }: Props) {
  const order: OdysseyLifeType[] = ['current', 'pivot', 'wildcard'];
  return (
    <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
      {order.map((type) => {
        const life = lives[type];
        const isElaborated = !!life.headline;
        return (
          <div key={type} className='border border-border rounded-lg bg-paper p-5'>
            <h2 className='text-[var(--text-lg)] font-semibold text-ink mb-1'>
              {TITLES[type]}
            </h2>
            {life.label.trim() && (
              <p className='text-[var(--text-sm)] text-ink-muted mb-3'>{life.label}</p>
            )}
            {isElaborated ? (
              <>
                <OdysseyElaboration life={life} />
                <OdysseyDashboard dashboard={life.dashboard} readOnly />
              </>
            ) : (
              <p className='text-[var(--text-sm)] text-ink-quiet italic mt-4'>
                {TITLES[type]} is not yet elaborated. Return to the cards to fill this in.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
