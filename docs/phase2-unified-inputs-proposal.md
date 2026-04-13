# Phase 2 — Unified Inputs + Actions Proposal

**Date captured:** 2026-04-13
**Status:** Parked — revisit before Phase 2 implementation
**Context:** Surfaced during Phase 2 brainstorming. Implementation paused to finish Phase 1 polish first.

---

## The idea

Rather than give each feature its own landing-page card ("Upload & Explore", "Chat with an Advisor", "Gap Analysis", "Learning Path"), the landing page becomes a **single surface with two zones**:

1. **Inputs** — optional materials the student provides, shared across every action
2. **Actions** — buttons the student picks, each using whatever inputs are filled

Click any action, the app assembles whichever filled inputs are relevant and runs the flow. If an action needs something not yet provided, the app prompts for it (inline hint or small modal).

This dissolves the "which path do I take?" decision by making **inputs additive and actions first-class**.

---

## Why it's better than the current two-card landing

- **No re-entry.** A student who pasted a resume for Find My Careers doesn't have to paste it again to try Gap Analysis later. The inputs persist in shared state.
- **One surface, no taxonomy burden.** Today the student picks between "Upload & Explore" and "Chat with an Advisor" before doing anything. Some students won't know which fits them.
- **Actions are discoverable.** All four (or more) actions visible in one glance. Phase 3/4/5 features become "add another button," not "add another card or route."
- **Matches real tool mental models.** Photo editor: load images, pick filter. IDE: open files, pick command. This is that.
- **Phase 1 collapses cleanly.** The current UploadCard and ChatCard both become actions on the same shared inputs — not separate pathways.

---

## Proposed inputs (all optional, all additive)

| Input | Form | Notes |
|---|---|---|
| Resume | File drop (PDF / MD / DOCX) | Reuses existing `LocalFileUpload` + `/api/parsePdf` |
| Job title | Single-line text | e.g., "Data Analyst" |
| About you | Textarea | Background, interests, goals, constraints |
| Job advert | Larger textarea | A pasted job posting |

**Deliberately dropped:** the Phase 1 ChatCard's "first chat message" field. Under this model, Start Chatting just opens the advisor pre-loaded with whatever shared inputs are filled (the chat route already accepts resume/text/title as context — we wired that up when fixing the resume-not-visible bug in Phase 1). One less thing to type.

**Deliberately kept separate:** About you vs Job advert. They're semantically different (you vs the role); merging them into one textarea confuses the LLM.

---

## Proposed actions

| Action | Requires | Behaviour |
|---|---|---|
| **Find my careers** | ≥1 of {resume, job title, about you, job advert} | Existing Phase 1 spider graph flow. The job advert becomes a new input shape passed to `getCareers`. |
| **Start chatting** | Nothing — can open empty | Existing Phase 1 advisor flow. All filled inputs go in as context. |
| **Gap analysis** | A **target** (job advert OR job title OR existing career from a prior session) AND a **profile** (resume OR about you OR existing distilled profile) | New. Analyse the target, compare to the profile, return structured gaps. |
| **Learning path** | A target. Profile optional (enhances, not required). | New. Returns a structured roadmap: skills, projects, courses, certs, timeline. Can chain after Gap Analysis for personalised priorities, or run standalone ("what should I learn to become X?"). |

**Missing-input handling:** If the student clicks Gap Analysis with only a resume, the app prompts: *"To analyse gaps, we need a job. Paste a job advert or enter a job title."* Inline highlight on the missing field, or a small modal. No hard errors.

**Progressive enhancement:** Every action works with the minimum required inputs and gets smarter when more are filled. Learning Path with just a job title is a generic roadmap; with a resume too, it's personalised; with a full chat profile from Phase 1, it's deeply tailored.

---

## Layout sketch (not committed to)

```
HERO
  Your Career. Your Direction.
  AI-powered career exploration that never leaves your device.

INPUTS  (4 fields in a 2-col grid or stacked)
  [ Resume drop zone       ]  [ Job title input         ]
  [ About you (textarea)   ]  [ Job advert (textarea)   ]

ACTIONS  (single row, 4 buttons)
  [ Find my careers ]  [ Start chatting ]  [ Gap analysis ]  [ Learning path ]
```

The SessionBanner still appears above the inputs when a prior session has state.

---

## Migration notes

- UploadCard and ChatCard collapse into one `<LandingInputs />` + `<LandingActions />` pair. The individual card components go away.
- Session store needs a `jobAdvert: string` field alongside the existing `resumeText`, `freeText`, `jobTitle`.
- `getCareers` route already accepts the unified input shape; adding `jobAdvert` is a small prompt-builder tweak.
- Chat route already passes resume/text/title as context; adding `jobAdvert` is one more line in `buildContextBlock`.
- Two new routes: `/api/gapAnalysis` and `/api/learningPath`. Both are thin wrappers like the chat/distillProfile routes.
- Two new output surfaces: where does gap analysis render, and where does learning path render? TBD — likely modal overlays on the landing page, similar to the Phase 1 profile review modal. Or dedicated `/gap` and `/learning` routes. Decide during Phase 2 brainstorming proper.

---

## When to revisit

Before kicking off Phase 2 implementation. The spec for Phase 2 should open from this idea rather than from the original phasing proposal's three-feature-card framing.

When you resume:
1. Re-read this doc
2. Decide: is this the shape we want? Any edits to inputs/actions before locking it in?
3. Re-enter brainstorming for the remaining Phase 2 questions (how does gap analysis output render, where does learning path live, what does the prompt for each look like, etc.)
4. Then writing-plans → implementation
