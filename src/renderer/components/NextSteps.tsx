import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export type NextStep = {
  title: string;
  description: string;
  path: string;
  preNavigate?: () => void;
};

// "What's next?" block shown under a finished result. Suggests the natural
// follow-on activities so result pages don't dead-end back at the hub.
export default function NextSteps({ steps }: { steps: NextStep[] }) {
  const navigate = useNavigate();
  if (steps.length === 0) return null;
  return (
    <div className='mt-8 max-w-2xl mx-auto'>
      <div className='editorial-rule justify-center mb-3'>
        <span>What&rsquo;s next?</span>
      </div>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        {steps.map((step) => (
          <button
            key={step.path}
            type='button'
            onClick={() => {
              step.preNavigate?.();
              navigate(step.path);
            }}
            className='border border-border rounded-lg bg-paper p-4 hover:border-ink-muted transition-colors duration-[250ms] cursor-pointer text-left w-full flex items-start justify-between gap-3'
          >
            <span>
              <span className='block text-[var(--text-base)] font-semibold text-ink mb-0.5'>
                {step.title}
              </span>
              <span className='block text-[var(--text-sm)] text-ink-muted leading-snug'>
                {step.description}
              </span>
            </span>
            <ArrowRight className='w-4 h-4 text-accent shrink-0 mt-1' />
          </button>
        ))}
      </div>
    </div>
  );
}
