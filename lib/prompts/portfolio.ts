import type { StudentProfile } from '@/lib/session-store';

export type PortfolioInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

function formatProfile(p: StudentProfile): string {
  return [
    `Background: ${p.background}`,
    `Interests: ${p.interests.join(', ')}`,
    `Skills: ${p.skills.join(', ')}`,
    `Constraints: ${p.constraints.join(', ')}`,
    `Goals: ${p.goals.join(', ')}`,
  ].join('\n');
}

function buildProfileSection(input: PortfolioInput): string {
  const parts: string[] = [];
  if (input.resume?.trim()) parts.push(`Resume:\n${input.resume.trim()}`);
  if (input.freeText?.trim()) parts.push(`About me:\n${input.freeText.trim()}`);
  if (input.distilledProfile) parts.push(`Distilled profile:\n${formatProfile(input.distilledProfile)}`);
  if (parts.length === 0) return '<profile>\n(Minimal profile provided.)\n</profile>';
  return `<profile>\n${parts.join('\n\n')}\n</profile>`;
}

export function buildPortfolioPrompt(input: PortfolioInput): string {
  const sections: string[] = [];

  sections.push(
    'Generate a complete, standalone HTML portfolio page for a student. The page must be a single self-contained HTML file with all CSS inline in a <style> tag in the <head>. No external stylesheets, no JavaScript, no external fonts — it must work when opened as a local file in any browser.'
  );

  sections.push(
    `Design:
- Dark navy header (#1a2332) with white text for the hero section
- White body (#ffffff) with dark text (#1a1a1a)
- Accent color (#4a8fd4) for section dividers, skill tags, and links
- System font stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- Clean typography: 16px base, 1.6 line-height, generous whitespace
- Responsive: looks good on both desktop and mobile (use CSS media queries)
- Professional and modern. No clip-art, no emojis, no decorative images.`
  );

  sections.push(
    `Sections to include:
1. Hero — Student's name (infer from resume or use "[Your Name]") and a one-line tagline summarising who they are and what they do.
2. About Me — 2-3 paragraphs. If a target role is provided, angle this toward that role. Otherwise, write a general professional summary.
3. Key Experience — 3-4 accomplishment bullets reframed from the resume. Use the "accomplished X by doing Y, resulting in Z" format where possible. Do not invent experiences — only reframe what is in the resume.
4. Skills — A grid of skill tags pulled from the resume and profile. Group into 2-3 categories if enough skills exist (e.g., Technical, Analytical, Communication).
5. What I'm Looking For — 1-2 sentences about the student's goals or target role. Only include this section if a target role is provided.
6. Contact — A placeholder section: "Get in touch: [your.email@example.com] · [LinkedIn] · [GitHub]". The student fills in real details after saving.

If a target role is provided, frame the entire page toward that role — the tagline, about me, and experience highlights should all position the student as a strong fit.`
  );

  if (input.jobTitle?.trim()) {
    sections.push(`<targetRole>\n${input.jobTitle.trim()}\n</targetRole>`);
  }
  if (input.jobAdvert?.trim()) {
    sections.push(`<jobAdvert>\n${input.jobAdvert.trim()}\n</jobAdvert>`);
  }

  sections.push(buildProfileSection(input));
  sections.push('Respond with ONLY the complete HTML document. No markdown, no code fences, no explanation. Start with <!DOCTYPE html>.');

  return sections.join('\n\n');
}
