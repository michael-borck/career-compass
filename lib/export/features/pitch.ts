// Elevator Pitch -> ExportDoc.
import type { ElevatorPitch } from '@/lib/session-store';
import { type ExportDoc, type Block, b, h2, p, disclaimer } from '../doc';

const paras = (s: string): Block[] => s.split('\n\n').filter(Boolean).map((t) => p(t));

export function pitchToExportDoc(pitch: ElevatorPitch): ExportDoc {
  return {
    title: 'Elevator Pitch',
    blocks: [
      p(b('Target:'), ` ${pitch.target ?? 'General'}`),
      h2('Your hook'),
      p(pitch.hook),
      h2('The pitch'),
      ...paras(pitch.body),
      h2('Your close'),
      p(pitch.close),
      h2('Full script'),
      ...paras(pitch.fullScript),
      disclaimer('AI-generated pitch. Edit to match your voice before using.'),
    ],
  };
}
