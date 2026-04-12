# Career Compass — Phasing Proposal

**Date:** 2026-04-12
**Status:** Proposal — awaiting review

---

## How I Grouped These

Three questions drove the ordering:

1. **What unblocks the most other features?** (Build foundations first)
2. **What transforms the app most for students?** (Biggest UX leaps early)
3. **What can be built independently?** (Parallelisable work later)

---

## Phase 1: Conversational Foundation

**Theme:** Transform Career Compass from a one-shot tool into an interactive advisor.

| Feature | Why now |
|---------|---------|
| F1: Career Advisor Chat | Everything else builds on this. Chat is the primary interaction model going forward. The spider graph becomes one output of many, not the whole app. |
| F2: Chat-to-Careers Pipeline | Without this, chat and career generation are disconnected. Students should flow naturally from conversation to results. |
| Flexible input (enhance existing) | Already partially done. Add job-title-only input ("I want to be a Data Analyst" as a starting point). Polish the resume + text + job title combination. |

**What the app looks like after Phase 1:**
Student opens the app. They can chat with a career advisor, upload a resume, type a description, or just enter a job title. The advisor helps them explore. At any point they can generate the career spider graph from their conversation. The chat has strong guardrails — it stays on career topics.

**Estimated scope:** Medium. New chat UI component, system prompt design, message state management, integration with existing career generation.

**Dependencies:** None — builds on current codebase.

---

## Phase 2: Reverse Workflow + Gap Analysis

**Theme:** Answer the question students actually ask: "I found a job I want — how do I get there?"

| Feature | Why now |
|---------|---------|
| F4: Job Advert Reverse Workflow | The #1 thing students do after finding a career path is look at job ads. This meets them at that moment. |
| F7: Resume Gap Analysis | Natural companion to F4. "Here's the job, here's your profile, here are the gaps." Also works standalone with the career paths from Phase 1. |
| F9: Learning Path Generator | Completes the loop. Gap identified → here's how to close it. Courses, projects, certifications, timeline. |

**What the app looks like after Phase 2:**
Student can paste a job advert and get a specific gap analysis against their profile. Each gap comes with a learning path. They can also get gap analysis against any career path from the spider graph. The app now answers both "what should I do?" and "how do I get there?"

**Estimated scope:** Medium. Mostly new LLM prompts and UI for job advert input + gap/learning path display. No new infrastructure.

**Dependencies:** Phase 1 (chat provides the profile context that makes gap analysis richer).

---

## Phase 3: Search Grounding + URL Input

**Theme:** Ground advice in current real-world data instead of stale training data.

| Feature | Why now |
|---------|---------|
| F13: Web Search Grounding | Salary data, job demand, certification requirements — all go stale. Search makes the advisor current. Port the multi-engine search from Study Buddy. |
| F3: URL / LinkedIn Input | With search infrastructure in place, URL scraping becomes a natural extension. Student pastes a LinkedIn URL, app extracts the content, uses it as input. |

**What the app looks like after Phase 3:**
The career advisor can back up its claims with current data. "Data Analysts in Perth earn $75-95k" comes with a search citation, not just LLM confidence. Students can paste a LinkedIn URL as an alternative to uploading a resume.

**Estimated scope:** Medium-large. Search infrastructure is proven (port from Study Buddy) but integration into the advisor flow needs care. URL scraping has edge cases (rate limits, different site structures).

**Dependencies:** Phase 1 (chat is where search results surface).

---

## Phase 4: Workshop Activities

**Theme:** Structured exercises from the career design workshop, built into the app.

| Feature | Why now |
|---------|---------|
| F11: Odyssey Plan Simulator | Most popular workshop activity. Structured input (3 lives) → rich output. Self-contained feature. |
| F12: Board of Advisors | Multi-perspective feedback. Different system prompts simulating different advisor personas debating the student's path. |
| F10: Career Path Comparison | Side-by-side comparison of 2-3 paths from the spider graph. Natural decision-support tool after exploration. |

**What the app looks like after Phase 4:**
Beyond free-form chat, students have structured exercises: plan 3 alternative lives, get feedback from a simulated advisory board, compare career paths side-by-side. These are guided workflows, not just open-ended conversation.

**Estimated scope:** Medium. Each is a relatively self-contained feature with its own UI and system prompt. No shared infrastructure needed.

**Dependencies:** Phase 1 (chat infrastructure). F10 depends on career generation (existing).

---

## Phase 5: Career Materials + Export

**Theme:** Help students produce deliverables from their exploration.

| Feature | Why now |
|---------|---------|
| F8: Pitch Deck / Career Materials | Elevator pitch, cover letter drafts, portfolio page. Natural outputs of the exploration process. |
| F15: Career Story / Narrative Builder | Help students find the thread connecting their experiences. Savickas' Career Construction Theory. |
| F16: Export / Report Generation | Copy to clipboard, export as PDF/Markdown, save spider graph as image. "Take it with you" functionality. |

**What the app looks like after Phase 5:**
Students can produce tangible career materials: an elevator pitch, a cover letter targeted at a specific role, a career narrative. Everything can be exported — career report as PDF, chat as Markdown, spider graph as image, individual career cards as text.

**Estimated scope:** Medium. Materials generation is mostly LLM prompts. Export requires PDF generation library and clipboard/image utilities.

**Dependencies:** Phase 1-2 (richer data to export). Could start F16 (basic clipboard copy) earlier.

---

## Phase 6: Frameworks + Interview Practice

**Theme:** Professional polish — map to recognised standards, practice for the real thing.

| Feature | Why now |
|---------|---------|
| F6: Skills Framework Mapping (SFIA, O*NET, ESCO) | Map skills to recognised professional frameworks. Most valuable once the core career tools are solid. |
| F14: Interview Role-Play | Simulate job interviews for a target role. Needs the chat infrastructure (Phase 1) and ideally search grounding (Phase 3) for realistic questions. |
| F5: Multi-Input Distillation | Combine resume + chat + URL + job advert into a unified profile. Most valuable when all input types exist. |

**What the app looks like after Phase 6:**
The complete vision. Skills mapped to SFIA/O*NET. Interview practice with AI feedback. All inputs automatically distilled into a coherent student profile. Career Compass is now a comprehensive career exploration platform, not just a resume analyser.

**Estimated scope:** Large. Framework data needs sourcing and structuring. Interview role-play is a significant interaction pattern. Distillation is complex LLM orchestration.

**Dependencies:** All previous phases (this is the capstone layer).

---

## Summary

| Phase | Theme | Features | Builds on |
|-------|-------|----------|-----------|
| 1 | Conversational foundation | F1, F2, flexible input | Current app |
| 2 | Reverse workflow + gaps | F4, F7, F9 | Phase 1 |
| 3 | Search + URL input | F13, F3 | Phase 1 |
| 4 | Workshop activities | F11, F12, F10 | Phase 1 |
| 5 | Materials + export | F8, F15, F16 | Phase 1-2 |
| 6 | Frameworks + polish | F6, F14, F5 | All |

**Phases 2, 3, and 4 are mostly independent of each other** — after Phase 1 ships, they could be built in any order or in parallel based on what feels most valuable.

**Phase 5 could start partially earlier** — basic clipboard copy (F16) is trivial and could ship with Phase 1.

---

## Suggested first move

Start with Phase 1. Design the chat component, the system prompt with guardrails, and the chat-to-careers pipeline. This is the single biggest transformation of the app and unblocks everything else.
