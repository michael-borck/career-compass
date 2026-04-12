# Career Compass — Feature Inventory

**Status:** Draft — capturing ideas before prioritisation
**Date:** 2026-04-12
**Context:** Career Compass is a privacy-first desktop app for university students (many ESL) exploring career paths. Currently it takes a resume or text input and generates 6 career suggestions via LLM. This document captures the full vision for what the app could become.

---

## Design Principles

### No persistence, generous export
- **Settings only:** API keys, provider, model persist in electron-store/safeStorage
- **Session is memory:** Resume text, chat, career results live in React state. Close the app, it's gone.
- **No database:** No SQLite, no files written to disk, no session history
- **Export, don't save:** Students copy/export what they want (clipboard, PDF, Markdown, image) into their own tools
- **Fresh start is a feature:** Students iterate on their resume between sessions. Re-uploading takes 3 seconds and ensures the app always works with the latest version.

### Flexible input — meet students where they are
Students can start from any of these, alone or combined:
- **Resume file** (PDF, DOCX, Markdown)
- **Free-form text** (paste a description, a chat transcript, anything)
- **Job title** (just type "Data Analyst" and go)
- **URL** (LinkedIn profile, portfolio site)
- **Chat conversation** (talk to the advisor, then generate careers from the discussion)

No single input is required. The app works with whatever the student brings.

---

## Current State

- Upload resume (PDF, DOCX, Markdown) or type skills/interests
- LLM generates 6 career paths with salary, timeline, difficulty
- Click a career card for detailed roadmap, fit analysis, work required
- Spider graph (ReactFlow) visualisation
- Multi-provider LLM support (Ollama, OpenAI, Claude, Groq, Gemini, OpenRouter, Custom)
- Privacy-first: local file processing, secure key storage
- Studio Calm design system (warm ochre accent)

---

## Feature Ideas

### F1: Career Advisor Chat
Conversational AI career advisor with strong guardrails to stay on-topic. Students can ask questions, explore ideas, and get guidance in a natural back-and-forth. System prompt enforces career-advisor persona — won't drift into writing code, doing homework, etc.

**Why:** Makes the app feel like a real tool, not a one-shot generator. Students can explore iteratively.

### F2: Chat-to-Careers Pipeline
Use the conversation from the chat as input to career generation. Instead of copy-pasting, the student clicks a button (e.g. an icon after the chat) to say "use this conversation to find my careers." The LLM distills the chat into a profile and feeds it to the existing career generation flow.

**Why:** Avoids the clunky copy-paste step. The chat already contains everything the LLM needs.

### F3: URL / LinkedIn Input
Accept a URL (LinkedIn profile, personal website, online portfolio) as an alternative input source. Scrape/extract the content and use it alongside or instead of a resume.

**Why:** Many students have a LinkedIn profile but not a polished resume. Meets them where they are.

### F4: Job Advert Reverse Workflow
Paste a job advert. The app analyses required skills, compares against the student's profile (from resume/chat/URL), identifies gaps, and generates a learning path for those gaps. Reverse of "here's my resume, what jobs fit?" — instead: "here's a job I want, what do I need?"

**Why:** Students often find a dream job posting and want to know how to get there.

### F5: Multi-Input Distillation
Combine multiple inputs — resume, chat session, LinkedIn URL, previous career results — into a unified student profile. The LLM distills all sources into a coherent picture, identifies gaps and inconsistencies, and uses the combined profile for better recommendations.

**Why:** No single input tells the whole story. A resume might miss soft skills the chat reveals. A LinkedIn profile might be outdated but the resume is current.

### F6: Skills Framework Mapping (SFIA and others)
Map identified skills and career paths to recognised professional frameworks:
- **SFIA** (Skills Framework for the Information Age) — IT and digital
- **O*NET** — US occupational classification (broad coverage)
- **ESCO** (European Skills, Competences, Qualifications and Occupations)
- **AQF** (Australian Qualifications Framework) — education levels
- Other discipline-specific frameworks TBD (nursing, engineering, business)

**Why:** Frameworks give students a shared vocabulary for talking about their skills with employers, and help map learning paths to recognised competencies. Particularly useful for international students navigating different qualification systems.

### F7: Resume Gap Analysis
Given a target career path (from F1/career generation) and the student's current profile, identify specific gaps: missing skills, experience areas, qualifications, certifications. Go beyond "you need Python" — explain what level, how to demonstrate it, what counts as evidence.

**Why:** "You'd be a good fit for Data Analyst" is encouraging but not actionable. "You need intermediate SQL, a portfolio project with real data, and familiarity with Tableau" is actionable.

### F8: Pitch Deck / Career Materials Generator
Help students create career-related materials:
- Elevator pitch (30-second, 2-minute)
- One-page career summary / personal pitch deck
- Simple portfolio webpage (HTML)
- Cover letter drafts targeted at specific roles
- Interview preparation notes

**Why:** Students often know what career they want but struggle to articulate it. These are natural outputs of the career exploration process.

### F9: Learning Path Generator
For any identified skill gap or career path, generate a structured learning path: recommended courses (free/paid), projects to build, certifications to pursue, timeline, milestones. Could integrate with SFIA levels (F6) to show progression.

**Why:** "Learn Python" is not a learning path. "Week 1-2: Complete Python basics on freeCodeCamp. Week 3-4: Build a data cleaning project using pandas. Week 5-6: Take the Google Data Analytics Certificate Module 3" is a learning path.

### F10: Career Path Comparison
Select 2-3 career paths from the spider graph and see them side-by-side: salary trajectory, required skills overlap, timeline differences, day-in-the-life descriptions, growth prospects. Help students choose between similar options.

**Why:** Students often narrow to 2-3 options and need help deciding. The current app shows each career in isolation.

---

## Open Questions

- How much should the chat feature know about previous sessions? (Privacy vs continuity)
- Should career results be saveable/exportable? (PDF report, shareable link)
- How do we handle LinkedIn scraping? (Rate limits, ToS, privacy implications)
- Should SFIA/framework data be bundled locally or fetched from an API?
- How do we keep framework data current without requiring app updates?
- What guardrails does the chat need beyond "stay on career topics"?
- Should there be a "student profile" that persists across sessions?

### F11: Odyssey Plan Simulator
Structured "3 alternative lives" exercise from the Designing Your Life framework. Student defines:
- Life 1 (Current Path): "I want to be a [Marketing Manager]"
- Life 2 (The Pivot): "If that disappeared, I'd become a [Teacher]"
- Life 3 (The Wildcard): "If money were no object, I'd be a [Travel Blogger]"

The AI fleshes out each alternative — what a typical day looks like in 2030, what technologies they'd use, what challenges they'd face. Makes Plan B and the Wildcard feel concrete, not hypothetical.

**Why:** Students struggle to imagine alternatives. This is the most popular activity from the workshop. Directly supports the "Odyssey Plan" assessment.

### F12: Board of Advisors
Multi-perspective feedback on a career goal. The AI simulates a "personal board of directors" — e.g. a pragmatic HR manager, a reframing-focused career coach, and a passion-driven entrepreneur — debating the student's chosen path. Surfaces risks they're ignoring and perspectives they haven't considered.

**Why:** Students get stuck in one frame of reference. Multiple simulated viewpoints break tunnel vision. The advisor personas could be configurable.

### F13: Web Search Grounding
Integrate web search (DuckDuckGo free scraping, with optional Bing/Serper/SearXNG/Brave) to ground career advice in current data. When the advisor discusses salary ranges, job demand, required certifications, or industry trends, it can search for current information rather than relying on training data alone.

Port the multi-engine search system from Study Buddy (`app/api/getSources/route.ts`).

**Why:** LLM training data goes stale. "Average salary for a Data Analyst in Perth" should reflect current job listings, not 2024 data. Also enables the "compare me to the market" workflow from the workshop (Activity 2).

### F14: Interview Role-Play
Simulate job interviews for a target role. The AI plays the interviewer — asking common questions, behavioural questions, technical questions — then gives feedback on the student's responses. Different difficulty levels (friendly first-round, tough panel, technical deep-dive).

**Why:** Interview practice is the #1 request from career services. Students can rehearse privately without embarrassment. Natural extension of the career advisor chat (F1). Similar pattern to Talk Buddy's conversation practice.

### F15: Career Story / Narrative Builder
Help students construct their career narrative — the thread connecting their education, experiences, skills, and aspirations into a coherent story. Based on Savickas' Career Construction Theory (from the workshop). The AI helps them find patterns they can't see themselves: "You keep gravitating toward roles where you explain complex things simply — that's a teaching instinct."

**Why:** Employers ask "tell me about yourself" and students give a chronological list. A career narrative is a story with a theme. This is hard to do alone.

### F16: Export / Report Generation
Export career exploration results as a structured document:
- PDF career report (career paths, gap analysis, learning plan)
- Career Passport format (if following a university framework)
- Markdown summary for personal reference
- Shareable link or static HTML page

**Why:** The spider graph is great for exploration but students need to submit career plans for assessment. Export bridges the gap between exploration and deliverable.

---

## Open Questions

- How do we handle LinkedIn/URL scraping? (Rate limits, ToS, privacy implications)
- Should SFIA/framework data be bundled locally or fetched from an API?
- What guardrails does the chat need beyond "stay on career topics"?
- How configurable should the Board of Advisors personas be?
- Should interview role-play record audio (like Talk Buddy) or text-only?
- What export formats matter most? (PDF, Markdown, clipboard, image)

## Resolved Decisions

- **No data persistence beyond settings.** Session data lives in memory only. (2026-04-12)
- **No database.** No SQLite, no file storage, no session history. (2026-04-12)
- **Export, don't save.** Students copy/export what they want into their own tools. (2026-04-12)
- **Flexible input.** Resume, free text, job title, URL, or chat — any combination. (2026-04-12)

---

## Not In Scope (for now)

- Job board integration / job search
- Application tracking
- Networking / mentorship matching
- Calendar / scheduling
- Social features
- Teamwork simulation / conflict role-play (workshop Activity 3 — better suited to Talk Buddy)

---

## Next Steps

1. Review this inventory — anything missing or mis-described?
2. Group features into logical phases
3. Identify dependencies (what needs to be built first?)
4. Pick Phase 1 and begin detailed design
