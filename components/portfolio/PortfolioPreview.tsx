'use client';

import type { Portfolio } from '@/lib/session-store';

export default function PortfolioPreview({ portfolio }: { portfolio: Portfolio }) {
  return (
    <div className='max-w-4xl mx-auto'>
      {portfolio.target && (
        <p className='text-[var(--text-sm)] text-ink-muted mb-3 text-center'>
          Tailored for: <span className='font-medium text-ink'>{portfolio.target}</span>
        </p>
      )}
      <iframe
        srcDoc={portfolio.html}
        sandbox='allow-same-origin'
        className='w-full border border-border rounded-lg bg-white'
        style={{ height: '70vh' }}
        title='Portfolio preview'
      />
    </div>
  );
}
