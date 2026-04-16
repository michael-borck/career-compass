# F8b — Portfolio Page Generator

**Date:** 2026-04-16
**Status:** Design approved — ready for implementation plan
**Phase reference:** Phase 5, split from F8. Ships after pitch, cover letter, and resume review.

---

## Summary

F8b generates a standalone HTML portfolio page from the student's profile. The LLM produces a complete, self-contained HTML document with inline CSS — no external dependencies, opens in any browser. The student previews it in a sandboxed iframe within the app, then saves it as an `.html` file.

Two flavours from the same feature: a **personal portfolio** (general "here's who I am") entered from the landing page, and a **role-tailored portfolio** ("here's who I am, positioned for this role") entered from the career card dropdown. Same prompt, same template, different framing based on whether a target role is provided.

---

## Design principles (inherited)

- No persistence beyond settings. Portfolio HTML lives in the session store, in-memory only.
- Privacy-first. No grounding, no external hosting.
- Export as file, don't save internally. The `.html` file is the deliverable.
- One LLM call, one opinionated template design, no editing environment.

---

## Architecture

### Route

`app/portfolio/page.tsx` — follows the endpoint-owned-inputs pattern:
1. Has result (`portfolio` in store) → render iframe preview + save button
2. No result, has required inputs → auto-run on mount
3. No result, missing inputs → render input card

### Session store additions

```ts
export type Portfolio = {
  html: string;
  target: string | null;
};
```

New field: `portfolio: Portfolio | null`
New action: `setPortfolio: (p: Portfolio | null) => void`
Cleared by `reset()` and `resetOutputs()` via `initialState`.

### API route

`app/api/portfolio/route.ts` — thin wrapper. Accepts `{ resume?, freeText?, jobTitle?, jobAdvert?, distilledProfile?, llmConfig? }`. Calls LLM with the portfolio prompt. Returns `{ html, target, trimmed }`.

Unlike other routes, the LLM returns raw HTML, not JSON. The route validates the response contains `<!DOCTYPE` or `<html` as a basic sanity check. If not, wraps the content in a minimal HTML shell (`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Portfolio</title></head><body>{content}</body></html>`).

Trim-retry: jobAdvert → resume → 500.

### Pure module

`lib/prompts/portfolio.ts` — `buildPortfolioPrompt(input)` only. No parser needed — the LLM output IS the HTML.

`lib/prompts/portfolio.test.ts` — tests for the prompt builder.

### Components

- `components/portfolio/PortfolioInputCard.tsx` — input card with profile fields
- `components/portfolio/PortfolioPreview.tsx` — sandboxed iframe + save button

---

## Input card

`PortfolioInputCard` follows the endpoint-owned-inputs pattern: all fields visible, pre-filled from store.

Fields:
- Resume (LocalFileUpload) — shown always, required (at least resume OR about-you)
- About you (Textarea) — shown always
- Job title (Input, optional) — when provided, the portfolio is tailored to this role
- Job advert (Textarea, optional) — same

Helper: "The more profile detail you provide, the richer the page. Add a target role to tailor it for a specific career."

Run button: "Generate portfolio page" with `Globe` (or `Layout`) Lucide icon. Disabled until at least one of `resumeText` or `freeText` is non-empty.

On run: POST `/api/portfolio`. On success: `store.setPortfolio({ html, target })`.

---

## The prompt

### `lib/prompts/portfolio.ts`

```ts
export type PortfolioInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  jobAdvert?: string;
  distilledProfile?: StudentProfile;
};

export function buildPortfolioPrompt(input: PortfolioInput): string;
```

Prompt body:

> Generate a complete, standalone HTML portfolio page for a student. The page must be a single self-contained HTML file with all CSS inline in a `<style>` tag in the `<head>`. No external stylesheets, no JavaScript, no external fonts — it must work when opened as a local file in any browser.
>
> **Design:**
> - Dark navy header (#1a2332) with white text for the hero section
> - White body (#ffffff) with dark text (#1a1a1a)
> - Accent color (#4a8fd4) for section dividers, skill tags, and links
> - System font stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
> - Clean typography: 16px base, 1.6 line-height, generous whitespace
> - Responsive: looks good on both desktop and mobile (use CSS media queries)
> - Professional and modern. No clip-art, no emojis, no decorative images.
>
> **Sections to include:**
> 1. **Hero** — Student's name (infer from resume or use "[Your Name]") and a one-line tagline summarising who they are and what they do.
> 2. **About Me** — 2-3 paragraphs. If a target role is provided, angle this toward that role. Otherwise, write a general professional summary.
> 3. **Key Experience** — 3-4 accomplishment bullets reframed from the resume. Use the "accomplished X by doing Y, resulting in Z" format where possible. Do not invent experiences — only reframe what's in the resume.
> 4. **Skills** — A grid of skill tags pulled from the resume and profile. Group into 2-3 categories if enough skills exist (e.g., Technical, Analytical, Communication).
> 5. **What I'm Looking For** — 1-2 sentences about the student's goals or target role. Only include this section if a target role is provided.
> 6. **Contact** — A placeholder section: "Get in touch: [your.email@example.com] · [LinkedIn] · [GitHub]". The student fills in real details after saving.
>
> If a target role is provided, frame the entire page toward that role — the tagline, about me, and experience highlights should all position the student as a strong fit.
>
> Respond with ONLY the complete HTML document. No markdown, no code fences, no explanation. Start with `<!DOCTYPE html>`.

The prompt appends the profile context (resume, about me, distilled profile, target role/advert) in the same `<profile>` / `<targetRole>` / `<jobAdvert>` XML block format used by every other prompt builder.

Temperature ~0.5 — structured enough for consistent HTML, creative enough for good copy.

### Tests

`lib/prompts/portfolio.test.ts`:
- Prompt includes resume when provided
- Prompt includes target role when provided
- Prompt asks for standalone HTML with inline CSS
- Prompt includes the design spec (dark navy header, system fonts)
- Prompt includes all six section names (Hero, About Me, Key Experience, Skills, What I'm Looking For, Contact)
- Prompt omits "What I'm Looking For" instruction when no target is provided — actually, the prompt always includes the instruction but says "only include if target role provided." The LLM decides. So this test just checks the instruction text is present.

---

## Preview and save

### `PortfolioPreview` component

Props: `{ portfolio: Portfolio }`

Renders:
- A sandboxed iframe using `srcdoc` attribute:
```tsx
<iframe
  srcDoc={portfolio.html}
  sandbox='allow-same-origin'
  className='w-full border border-border rounded-lg'
  style={{ height: '70vh' }}
  title='Portfolio preview'
/>
```

No "Save as HTML" button here — the page shell owns that (consistent pattern).

### Page shell buttons (when portfolio exists)

- **Save as HTML** — blob download:
```ts
function handleSave() {
  const blob = new Blob([portfolio.html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = portfolio.target
    ? portfolio.target.replace(/\s+/g, '-').toLowerCase()
    : 'personal';
  a.download = `portfolio-${slug}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Portfolio saved as HTML');
}
```

- **Generate another** — clears `portfolio`, returns to input card.
- **Start over** — `resetOutputs()`.

No "Copy as Markdown" — the deliverable is HTML, not text.

---

## Landing page integration

### Materials pillar — fourth card

```
─── Materials ───
[Elevator pitch]
[Cover letter]
[Resume review]
[Portfolio page]       Generate a personal portfolio website.
```

Icon: `Globe` from Lucide. Navigates to `/portfolio`.

### Career card dropdown

Add to the Materials group in the dropdown:

```tsx
<DropdownMenuItem onClick={handleBuildPortfolio}>
  <Globe className='w-4 h-4 mr-2' /> Build a portfolio for this role
</DropdownMenuItem>
```

Handler:
```ts
function handleBuildPortfolio() {
  if (!jobTitle) return;
  setStoreJobTitle(jobTitle);
  useSessionStore.getState().setPortfolio(null);
  router.push('/portfolio');
}
```

### SessionBanner

Add detection + link:
```ts
const hasPortfolio = !!portfolio;
```
```tsx
{hasPortfolio && (
  <Link href='/portfolio' className='underline hover:text-accent'>
    portfolio ready{portfolio.target ? ` (${portfolio.target})` : ''}
  </Link>
)}
```

---

## Error handling

- **No profile material** → input card, Run disabled until resume or about-you present.
- **LLM provider not configured** → pre-flight, toast + `/settings` redirect.
- **Token limits** → trim-retry (jobAdvert → resume → 500 "Profile too long for a portfolio page").
- **LLM returns non-HTML** → route wraps in minimal HTML shell. Preview still works; the content just won't be styled.
- **LLM returns truncated HTML** (missing closing tags) → browsers are forgiving; the iframe will render what it can. Not ideal, but not a crash. The student regenerates.
- **Save failure** → toast "Could not save the file."

---

## Testing

### Unit tests

- `lib/prompts/portfolio.test.ts` — prompt builder tests (profile inclusion, target inclusion, HTML instructions, section names, design spec)
- `lib/session-store.test.ts` — `setPortfolio`, `reset()` clears, `resetOutputs()` clears

### Manual QA

- [ ] Materials pillar shows 4 cards: Elevator pitch, Cover letter, Resume review, Portfolio page
- [ ] Click Portfolio page with no inputs → input card with all fields
- [ ] Upload resume → Run → loading → iframe preview renders the generated HTML
- [ ] Preview looks professional: dark navy header, white body, accent color, responsive
- [ ] Save as HTML → downloads `.html` file → open in browser → same content
- [ ] Generate another → returns to input card
- [ ] With target role filled → "What I'm Looking For" section appears in the generated page
- [ ] Without target role → "What I'm Looking For" section absent
- [ ] Career card dropdown → "Build a portfolio for this role" → `/portfolio` with target pre-filled
- [ ] Auto-run: arrive with resume already loaded → portfolio generates on mount
- [ ] SessionBanner shows "portfolio ready" or "portfolio ready (Data analyst)"
- [ ] Start over → portfolio cleared
- [ ] No "Copy as Markdown" button on this page (deliberate)
- [ ] Iframe is sandboxed (no script execution)
- [ ] Saved HTML opens correctly as a local file (no broken external references)

---

## Scope

### In scope
- `Portfolio` type + field + action in session store
- `lib/prompts/portfolio.ts` prompt builder + tests
- `app/api/portfolio/route.ts` with HTML validation + trim-retry
- `app/portfolio/page.tsx` orchestrator (input card / loading / preview)
- `components/portfolio/PortfolioInputCard.tsx`
- `components/portfolio/PortfolioPreview.tsx` (iframe)
- Landing Materials pillar — add fourth card
- Career card dropdown — add portfolio entry
- SessionBanner — add portfolio link
- File save via blob download

### Out of scope
- Template picker (single design, future enhancement)
- Inline editing of the generated page
- Regenerate-with-feedback loop
- Hosting or deployment of the portfolio
- Image generation or placeholder images
- JavaScript in the generated page (static HTML only)
- Markdown export (deliverable is HTML)
