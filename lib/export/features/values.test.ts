import { describe, it, expect } from 'vitest';
import { valuesCompassToExportDoc } from './values';
import { toMarkdown } from '../to-markdown';
import type { ValuesCompass } from '@/lib/session-store';

const compass: ValuesCompass = {
  summary: 'Autonomy leads.',
  values: [
    {
      name: 'Autonomy',
      rank: 1,
      description: 'You want room to decide.',
      evidence: 'You left structured roles twice.',
      reflectionQuestion: 'Where do you need guardrails?',
    },
    { name: 'Impact', rank: 2, description: 'Work that lands.', evidence: '', reflectionQuestion: '' },
  ],
  tensions: ['Autonomy vs stability'],
};

describe('valuesCompassToExportDoc', () => {
  it('renders summary, ranked values with evidence and reflection, and tensions', () => {
    const md = toMarkdown(valuesCompassToExportDoc(compass));
    expect(md).toContain('# Values Compass');
    expect(md).toContain('Autonomy leads.');
    expect(md).toContain('### 1. Autonomy');
    expect(md).toContain('**Why we think this:** You left structured roles twice.');
    expect(md).toContain('*Where do you need guardrails?*');
    expect(md).toContain('### 2. Impact');
    expect(md).toContain('## Tensions to explore');
    expect(md).toContain('- Autonomy vs stability');
  });

  it('skips evidence/reflection when empty and omits tensions when none', () => {
    const md = toMarkdown(
      valuesCompassToExportDoc({ ...compass, values: [compass.values[1]], tensions: [] })
    );
    expect(md).not.toContain('Why we think this:');
    expect(md).not.toContain('Tensions to explore');
  });
});
