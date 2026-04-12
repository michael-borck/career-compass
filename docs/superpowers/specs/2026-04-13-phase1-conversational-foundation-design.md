# Phase 1 — Conversational Foundation

**Date:** 2026-04-13
**Status:** Design approved — ready for implementation plan
**Phase reference:** `docs/phasing-proposal.md` Phase 1

---

## Summary

Transform Career Compass from a one-shot resume analyser into an interactive advisor. Phase 1 ships three tightly coupled pieces:

1. **F1 — Career Advisor Chat.** A warm, in-character career advisor with domain guardrails (career topics broadly; no code, no images, no homework, no therapy).
2. **F2 — Chat-to-Careers Pipeline.** Distill a chat conversation into a structured `StudentProfile`, let the student review and edit it, then feed it into the existing career generator.
3. **Flexible input polish.** Add job-title-only input on the landing page, and allow attaching resume / free text / job title mid-chat via a paperclip menu. (URL input is deferred to Phase 3.)

Both entry points — traditional upload flow and advisor chat — live as peer options on the landing page. They share a single in-memory session store, so a student can move freely between them: upload a resume → see the spider graph → "chat about this career card" → distill a refined profile → regenerate the graph. No forced linear path.

---

## Design principles (inherited)

- **No persistence beyond settings.** Session state lives in memory only. Close the app, it's gone.
- **No database.** No SQLite, no file storage.
- **Export, don't save.** (Export itself is Phase 5; the principle just governs what we don't build.)
- **Flexible input.** Resume, free text, job title — any combination, none required.
- **Privacy-first.** Local file processing; LLM API calls are the only external traffic.

---

## Architecture

### Session state container

New file `lib/session-store.ts`, implemented with Zustand (~1KB dependency, no boilerplate, Next.js-friendly). In-memory only, cleared on app close.

```ts
type StudentProfile = {
  background: string;
  interests: string[];
  skills: string[];
  constraints: string[];
  goals: string[];
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  kind?: 'message' | 'focus-marker' | 'attachment-summary' | 'notice';
};

type SessionState = {
  // Inputs
  resumeText: string | null;
  resumeFilename: string | null;
  freeText: string;
  jobTitle: string;

  // Chat
  chatMessages: ChatMessage[];
  currentFocus: string | null;

  // Outputs
  distilledProfile: StudentProfile | null;
  careers: Career[] | null;
  selectedCareerId: string | null;

  // Actions
  setResume: (text: string, filename: string) => void;
  setFreeText: (text: string) => void;
  setJobTitle: (title: string) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setFocus: (career: string | null) => void;
  setDistilledProfile: (profile: StudentProfile | null) => void;
  setCareers: (careers: Career[] | null) => void;
  reset: () => void;
};
```

Both entry points (landing card, chat) write into this store. `/careers` reads from it instead of receiving props or URL params. This is what makes bidirectional navigation work without duplicating state.

### Routes

- `/` — landing page with two peer cards
- `/chat` — advisor chat
- `/careers` — spider graph (reads from session store)

No other new routes in Phase 1.

---

## Landing page (`app/page.tsx`)

The existing hero remains. Below it, two peer cards side-by-side.

### Card 1 — "Upload & Explore"

All three traditional inputs inline on one card:

- **Resume drop zone** (reuses existing `LocalFileUpload` component)
- **Free-text area** — placeholder: *"Describe your background, interests, and goals."*
- **Job title field** — placeholder: *"Or just tell me a job title you're curious about (e.g., Data Analyst)"*
- **Primary CTA:** "Find my careers" — disabled until at least one of the three is non-empty.

On click: write inputs to the session store → navigate to `/careers` → `/careers` triggers `getCareers` using the store contents.

### Card 2 — "Chat with an Advisor"

- Short copy: *"Not sure where to start? Talk it through with a career advisor."*
- **Primary CTA:** "Start chatting" → navigate to `/chat`.

### `getCareers` route update

Current `app/api/getCareers/route.ts` accepts a single resume-shaped input. Extend it to accept a unified shape:

```ts
type GetCareersInput = {
  resume?: string;
  freeText?: string;
  jobTitle?: string;
  distilledProfile?: StudentProfile;
};
```

The prompt builder assembles whatever is present into a coherent "about this student" section. No change to the existing two-stage LLM flow (initial 6 careers → detailed analysis per card) — only the input shape.

**Job-title-only flow.** When only `jobTitle` is present, the prompt frames it as exploration: *"The student is curious about becoming a `{jobTitle}`. Generate 6 adjacent or alternative career paths they might explore, including the stated one and variants/progressions."* This makes job-title-only a legitimate starting point rather than a degenerate case.

---

## Chat page (`/chat`)

### Layout

Full-height flex, three rows:

- **Top bar:** title *"Career Advisor"*, current focus chip (if set) — e.g. `Focused on: Data Analyst ✕` — and a "Generate careers from this chat →" button (disabled until ≥3 user messages).
- **Middle:** scrollable message list, auto-scroll to bottom on new message.
- **Bottom:** composer with paperclip, text input, send button.

### Message rendering

- User messages right-aligned, advisor left-aligned. Styled with the existing Studio Calm palette (warm neutrals, ochre accent for user bubbles).
- **Focus markers** render as centered dividers: `— Now focused on Data Analyst —`.
- **Attachment summaries** render as compact cards (📎 resume.pdf, 2.3k chars) with an expandable "what the advisor sees" section.
- **Notices** (e.g., long-chat trim notice) render as subtle centered banners distinct from message bubbles.

### Paperclip menu

Lets the student attach any of:
- **Resume file** — opens file picker, reuses existing `LocalFileUpload` / `parsePdf` / `mammoth` pipeline. On success, writes parsed text to the store and inserts an `attachment-summary` chat message.
- **Paste text** — modal with textarea; becomes a user message.
- **Add job title** — inline input; becomes a user message phrased like *"I'm curious about becoming a `{title}`"*, and writes to the store.

All three update the session store *and* insert a message into the chat so the conversation stays coherent.

### Transport

Non-streaming. New route `app/api/chat/route.ts`:

- Input: full `chatMessages` history + current `currentFocus` + any attached resume/text/title.
- Reuses the existing `lib/llm-providers.ts` abstraction.
- Output: one assistant message, appended to the store by the client.

Streaming is explicitly deferred — it adds SSE handling, partial-message state, and abort logic for no functional gain in a local-LLM-first app. It can be retrofitted later without touching the store shape.

### System prompt

Locked to **"B-with-warmth"** — career-domain broad, capability-restricted, warm in tone.

```
You are a warm, encouraging career advisor for university students, many of whom
are learning English as a second language. Speak clearly and simply. Be patient,
curious, and supportive — celebrate progress, ask gentle follow-up questions, and
help students articulate what they want.

SCOPE — you help with:
- Career exploration and path discovery
- Skills, study paths, qualifications
- Resume/CV advice, cover letters, interview preparation
- Salary, industry trends, job market questions
- Gap analysis between where they are and where they want to be

YOU DO NOT:
- Write code (Python, JavaScript, etc.) — if asked, briefly explain why the skill
  matters for their career and point to tools they could use (e.g., "a coding
  assistant or editor")
- Generate images, charts, or diagrams — if useful, describe what the image should
  show and suggest tools (Midjourney, DALL-E, Excel, Canva)
- Do homework or general-purpose chat — gently redirect to career topics
- Act as a therapist — if a student seems distressed, acknowledge briefly and
  suggest they speak to their university's student support services

When the student shares a resume, text, or job title, weave it naturally into the
conversation. When the focus is set to a specific career (e.g. "Data Analyst"),
center your responses on that path while still answering related questions.

Language: match the student's level. If they write simply, respond simply. Never
be condescending.
```

Focus updates are applied by appending a line `Current focus: {currentFocus}` to the system prompt on each turn (not baked into history), so focus changes take effect cleanly without polluting conversation state.

---

## Chat-to-Careers pipeline (F2)

### Trigger

"Generate careers from this chat →" button in the chat top bar. Enabled after ≥3 user messages.

### Flow

1. **Distillation LLM call** — new route `app/api/distillProfile/route.ts`.
   - Input: full chat history + any attached resume/text/title.
   - Prompt: produce a structured JSON `StudentProfile` (shape defined above).
   - Temperature: ~0.3 for consistency.
   - Uses the existing LLM provider abstraction.

2. **Review panel** — modal overlay on `/chat` that renders the distilled profile as editable fields:
   - `background` — small textarea
   - `interests`, `skills`, `constraints`, `goals` — add/remove chip lists
   - **Accept & generate** → writes profile to session store, navigates to `/careers`, which calls `getCareers` with `{ distilledProfile }`.
   - **Redistill with guidance** → small input for a guidance string (e.g., *"focus on the data analyst thread, ignore the teaching tangent"*), re-runs step 1 with the guidance appended.
   - **Cancel** → back to chat.

3. **`/careers` rendering** — already reads from the session store, so the spider graph renders identically regardless of whether inputs came from the landing card or the distilled chat profile.

### Bidirectional navigation — "Chat about this card"

Each career card gets a new action: **"Chat about this"**. On click:

- Set `currentFocus` in the session store to the career name.
- Insert a focus-marker message into the existing chat thread.
- Navigate to `/chat`.

The chat thread is preserved — no fork, no new session. The advisor's next turn is scoped to the focused career via the system prompt focus line. This matches how workshop conversations actually flow (students circle back, explore multiple cards without wanting to lose prior context).

### Round-trip loop

Resume → landing card → careers → "Chat about Data Analyst" → `/chat` with focus → more conversation → "Generate careers from this chat" → review panel → accept → refined spider graph. All within one session, one store, no data loss.

---

## Error handling

**LLM provider failures.** Chat route and distillation route reuse `lib/llm-providers.ts` error patterns. On chat failure, insert an error bubble (*"The advisor couldn't respond — check your provider settings"*) with a retry button that re-sends the last user turn. On distillation failure, show a toast on the review panel with a retry button; chat history is preserved.

**No provider configured.** Both entry points check for a configured provider before the first LLM call. If none, redirect to `/settings` with a toast: *"Set up an LLM provider to start."*

**Empty or degenerate inputs.** Landing CTA disabled unless at least one input is non-empty. "Generate careers from chat" disabled until ≥3 user messages. If distillation returns an all-empty profile, the review panel shows the chat and prompts for guidance instead of auto-proceeding.

**Resume parse failure.** Existing parse error paths surface toasts. In chat, a failed attachment is not added to the store or the message list.

**Long-chat fallback.** On token-limit errors:

- **Chat route:** retry with last 20 messages + system prompt + attachments. Insert a subtle notice bubble: *"Earlier messages were trimmed to fit — I still have your resume and recent context."*
- **Distillation route:** retry with last 30 messages + attachments. Distillation prompt gets a prefix: *"This is the recent portion of a longer conversation."* Review panel shows a banner: *"Your chat was long, so the profile was built from the most recent portion. Edit below to add anything important from earlier."*
- **If trimmed retry still fails** (rare): show an error with two actions — *"Edit profile manually"* (empty review panel) and *"Start a new chat"* (clears chat, keeps attachments).

No rolling summarisation and no chunked distillation in Phase 1; the trim-and-retry fallback is sufficient.

**Stale focus.** If the student regenerates careers while focused on a career that no longer exists in the new set, `currentFocus` is cleared and a marker is inserted: *"— focus cleared, new careers generated —"*.

**Session reset.** A "Start over" action in the header clears the session store (not settings). Confirmation dialog required — this is destructive.

---

## Testing

### Unit tests (Vitest — new setup)

No test framework is currently configured in the project. Phase 1 adds Vitest with a minimal config (`vitest.config.ts`, `npm run test` script) — no React-component rendering yet, just pure function and route handler tests.


- `lib/session-store.ts` — action behaviours: set/reset/focus transitions, distilled profile accept/replace, careers clearing on focus reset.
- `app/api/getCareers/route.ts` prompt builder — snapshot tests for each combination of `{resume}`, `{freeText}`, `{jobTitle}`, `{distilledProfile}`.
- `app/api/distillProfile/route.ts` — JSON parsing and validation with a mocked LLM response; guidance-string threading.

### Integration-ish tests

Mock the LLM provider at the `lib/llm-providers.ts` boundary. Run the chat and distillation routes end-to-end with canned responses and assert store updates.

### Manual QA checklist

- [ ] Upload resume → spider graph renders
- [ ] Type free text only → spider graph renders
- [ ] Type job title only → spider graph renders with that title and variants
- [ ] Resume + text + title combined → graph renders
- [ ] Start chat → advisor responds in character
- [ ] Ask chat to write Python → politely refuses with redirect and tool suggestion
- [ ] Ask chat for homework help → politely refuses
- [ ] Paperclip resume mid-chat → attachment summary appears, advisor references it
- [ ] Paperclip text mid-chat → appears as user message
- [ ] Paperclip job title mid-chat → appears as user message and updates store
- [ ] Generate careers from chat → review panel shows editable profile
- [ ] Edit a profile field → accept → careers reflect the edit
- [ ] Redistill with guidance → profile updates
- [ ] From career card, click "Chat about this" → focus marker appears in same thread
- [ ] Clear focus → marker shows focus cleared
- [ ] Regenerate careers while focused on a now-absent career → focus auto-clears with marker
- [ ] Simulate token-limit error on chat route → trimmed notice appears, advisor still responds
- [ ] Simulate token-limit error on distillation → trimmed banner appears in review panel
- [ ] Start over → session clears, settings retained
- [ ] Electron dev build works (`npm run electron:dev`)

### Not tested in Phase 1

- Actual LLM output quality (subjective; requires human review).
- Behaviour past the trim-and-retry fallback (Phase 2 concern).
- Streaming (not implemented).

---

## Scope & non-goals

### In scope

- Zustand session store (`lib/session-store.ts`)
- Landing page redesign: two peer cards
- Traditional card inputs: resume, free text, job title (new)
- `getCareers` route: unified input shape incl. `jobTitle` and `distilledProfile`
- `/chat` page: advisor chat with system prompt, paperclip attachments, focus markers
- `app/api/chat/route.ts` (non-streaming)
- `app/api/distillProfile/route.ts`
- Review panel for distilled profile (editable, redistill, accept)
- `/careers`: reads from session store; "Chat about this" action per card
- "Start over" session reset
- Long-chat trim-and-retry fallback for both chat and distillation
- Unit tests + manual QA checklist

### Explicitly out of scope (deferred)

| Deferred item | Phase |
|---|---|
| URL / LinkedIn input | 3 |
| Web search grounding | 3 |
| Job advert reverse workflow, gap analysis | 2 |
| Learning path generator | 2 |
| Interview role-play (F14) and Talk Buddy scenario export | revisit after Phase 2 |
| Streaming chat responses | later |
| Rolling summarisation / chunked distillation | later if trim-and-retry proves insufficient |
| Export / report generation | 5 |
| Session persistence across app restarts | never (violates principle) |
| Career comparison, pitch deck, materials | 4–5 |
| Skills framework mapping (SFIA etc.) | 6 |
| Odyssey plan, board of advisors | 4 |

### Phasing-doc note to carry forward

F14 (Interview Role-Play) should be revisited for earlier placement after Phase 2 ships. Phase 1 chat + Phase 2 job-advert/gap analysis makes interview practice the natural next step; leaving F14 in Phase 6 is likely wrong. Not a Phase 1 change — just a note.

Talk Buddy scenario export (at `/Users/michael/Projects/talk-buddy`) is a small addition to F14 when it lands: Career Compass emits a JSON file matching Talk Buddy's `Scenario` shape (`name`, `description`, `category`, `difficulty`, `estimatedMinutes`, `systemPrompt`, `initialMessage`, `tags`), which Talk Buddy's existing Upload flow on `ScenariosPage` can import directly.

---

## Open questions

None blocking. The following are resolved and captured above:

- Entry-point model → two peer cards (Option 1 from brainstorming Q5a).
- Guardrails → B-with-warmth: career-domain broad, capability-restricted, warm tone.
- Distillation → LLM call with editable review panel and redistill-with-guidance.
- Bidirectional navigation → single chat thread with focus markers (Option C from Q6).
- State container → Zustand.
- Transport → non-streaming.
- Long-chat handling → trim-and-retry fallback, no summarisation.
