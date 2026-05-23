// Industry Exploration -> ExportDoc.
import type { IndustryExploration } from '@/lib/session-store';
import { type ExportDoc, type Block, h2, h3, p, bullets, disclaimer } from '../doc';

export function industryExplorationToExportDoc(e: IndustryExploration): ExportDoc {
  const blocks: Block[] = [];

  blocks.push(h2('Overview'));
  for (const para of e.overview.split('\n\n').filter(Boolean)) blocks.push(p(para));

  blocks.push(h2('Key roles'));
  for (const role of e.keyRoles) {
    const tag = role.entryLevel ? ' [Entry-level friendly]' : '';
    blocks.push(h3(`${role.title}${tag}`));
    blocks.push(p(role.description));
  }

  if (e.entryPoints.length > 0) {
    blocks.push(h2('How to break in'));
    blocks.push(bullets(e.entryPoints, '→'));
  }
  if (e.growthAreas.length > 0) {
    blocks.push(h2("What's growing"));
    blocks.push(bullets(e.growthAreas, '↑'));
  }
  if (e.dayInTheLife) {
    blocks.push(h2('A day in the life'));
    blocks.push(p(e.dayInTheLife));
  }
  if (e.skillsInDemand.length > 0) {
    blocks.push(h2('Skills in demand'));
    blocks.push(bullets(e.skillsInDemand));
  }
  if (e.challenges.length > 0) {
    blocks.push(h2('Challenges to know about'));
    blocks.push(bullets(e.challenges));
  }

  blocks.push(
    disclaimer('AI-generated overview. Verify specific claims before making decisions.')
  );

  return { title: `Industry Exploration: ${e.industry}`, blocks };
}
