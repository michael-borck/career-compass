# Career Compass — Lab Guide for Lecturers

This guide explains how to run a hands-on career-exploration lab using Career
Compass. It is written for lecturers and tutors — no technical background
needed. There is a 1-hour and a 2-hour version of the lab, plus everything you
need to prepare beforehand.

**What the app does:** students upload their resume, and an AI suggests career
paths, analyses skill gaps, and helps them draft pitches and cover letters.
Everything runs on the student's own computer — resumes are read locally and
are only ever sent, as text, to the AI service *you* choose. No accounts, no
tracking, no data collected by us.

---

## Part 1 — Before the lab (lecturer preparation)

Do this at least a few days before the lab. Total time: about 30 minutes.

### Step 1. Choose how students will connect to an AI

The app needs an AI "brain" to generate suggestions. Pick **one** of these as
your main path (Option A is recommended for a class):

| Option | What it is | Accounts needed? | Cost | Speed |
|---|---|---|---|---|
| **A. Shared class server** (recommended) | Your university runs an Ollama AI server; the whole class uses it with one shared secret key | None | Free | Depends on the server — can be slow with a full class |
| **B. Ollama on the student's computer** | Each student installs the free Ollama app and downloads an AI model (~2–5 GB) | None | Free | Fine, but setup takes 15–20 min and needs a reasonably modern computer |
| **C. Student's own cloud account** | Student signs up for a free account at groq.com (fast, free tier) or uses an existing OpenAI/Google/Anthropic key | Yes — one per student | Free tier is enough for the lab | Fast |

**Recommendation:** use Option A as the default, and mention Option C as the
fallback for any student who cannot connect. Option C is also a good
load-spreader if the class server gets slow — the more students on Groq, the
faster the server is for everyone else.

### Step 2. If using the class server (Option A), collect three details

Ask whoever runs the server for:

1. **The server address** — it must end in `/v1`, for example
   `https://ollama.your-uni.edu.au/v1`
2. **The secret key** (sometimes called a bearer token) — one shared key for
   the whole class is fine
3. **The model name** students should pick, for example `llama3.2:3b`

> **Important — ask for a small, fast model.** A whole class generating
> results at once is heavy. A small model (a "3b" or "7b" model) keeps
> everyone moving; a large model will cause timeouts. Mention this to your
> server administrator.

### Step 3. Test it yourself

1. Download and install the app (see student Step 1 below — same process).
2. Open **Settings** (gear icon), and under **AI provider** choose
   **Ollama**.
3. In **Server address**, paste the server address from Step 2.
4. In **Secret key (optional)**, paste the secret key.
5. Click **Refresh models**, pick the model, then click **Check connection**.
   You should see *"Connected successfully"*.
6. Click **Save settings**, go back to the home page, upload any resume (a
   sample is fine), and generate career suggestions once — note how long it
   takes. If it takes more than ~2 minutes on an empty server, ask for a
   smaller model before lab day.

*You need app version 0.5.1 or newer for the secret-key field to appear for
Ollama.*

### Step 4. Post the details for students

Put this on your LMS page (or a slide shown at the start of class):

- The download link: **https://github.com/michael-borck/career-compass/releases/latest**
- The server address, secret key, and model name
- A note for Windows users: *the installer may show a blue "Windows protected
  your PC" warning — click "More info", then "Run anyway". This appears
  because the app is free/open-source software, not because anything is
  wrong.* (The Mac version is Apple-notarised and installs without warnings.)
- Ask students to **bring a resume file** (PDF or Word). Also link 2–3 sample
  resumes for students who don't have one or prefer not to use their own —
  sample resumes also make class discussion easier because everyone can
  compare results.

**Optional but recommended:** ask students to install the app *before* class.
It saves 10 minutes of lab time.

---

## Part 2 — Student setup (first 10 minutes of the lab)

Have students follow these steps. They are also worth putting on a slide.

1. **Download and install** the app from the releases link (pick the file for
   your computer: `.dmg` for Mac, `.exe` for Windows, `.AppImage` or `.deb`
   for Linux). Windows users: click "More info" → "Run anyway" on the blue
   warning.
2. Open the app and click the **Settings** gear icon.
3. Under **AI provider**, choose **Ollama**.
4. In **Server address**, type the address from the board/LMS (it ends in
   `/v1`).
5. In **Secret key (optional)**, paste the class secret key.
6. Click **Refresh models** and choose the model named on the board.
7. Click **Check connection** — wait for *"Connected successfully"*.
8. Click **Save settings**.

**If a student cannot connect** (personal laptop not on the right network,
etc.): have them create a free account at **groq.com**, copy their API key,
and in Settings choose **Groq** as the provider instead, paste the key, refresh
models, and save. This takes about 3 minutes.

---

## Part 3 — The 1-hour lab

The design principle: **students reflect while the AI computes.** The class
server will be slow when everyone generates at once, so every "waiting" moment
has a paper-and-pen task attached.

| Time | Activity | Uses the AI? |
|---|---|---|
| 0–10 min | Install and connect (Part 2 above). Early finishers help neighbours. | No |
| 10–20 min | Upload resume. Fill in the context fields: goals, constraints, what matters to them. This is the real reflective work — encourage full sentences, not keywords. | No |
| 20–40 min | Click generate to get **6 career suggestions**. *While it runs:* students write down their own predicted top-3 careers on paper, before seeing the AI's answer. | Yes |
| 40–55 min | Each student picks **one** suggested career and generates its detailed roadmap. Compare with their prediction: What surprised you? What did the AI get wrong about you? | Yes |
| 55–60 min | Debrief discussion: Was the AI's reading of your resume fair? What did it miss that a human mentor would see? | No |

**Crowd-control tip:** don't have all students click "generate" at the same
moment. Release them row by row, 30 seconds apart, and the server will feel
twice as fast.

---

## Part 4 — The 2-hour lab

Hour 1 is the same as above. Then:

| Time | Activity | Uses the AI? |
|---|---|---|
| 60–75 min | **Odyssey plans**: on the Odyssey page, students hand-write three different 5-year futures for themselves (the adventurous one, the safe one, the wildcard). Pure reflection — no server load. | No |
| 75–95 min | Split the class in thirds. Each third uses a **different** tool — Gap Analysis, Skills Mapping, or Compare (two careers side by side) — and generates once. Splitting spreads the server load. | Yes |
| 95–110 min | Each student produces **one artifact**: an Elevator Pitch or a Cover Letter for their chosen career. This is the take-home. | Yes |
| 110–120 min | Closing discussion on AI literacy: two students with similar resumes got different suggestions — why? Is this advice, or a mirror? When would you trust it, and when not? | No |

---

## Part 5 — Talking points about privacy (worth 5 minutes of any lab)

This app is deliberately built privacy-first, which makes it a good teaching
moment:

- The resume file is read **on the student's computer**. Only its text is sent
  to the AI server — with Option A, that means it never leaves university
  infrastructure. Compare this with pasting a resume into a free chatbot
  website.
- Secret keys are stored in the computer's own secure vault (Keychain on Mac,
  Windows' built-in encryption on Windows).
- There are no accounts and no analytics. Nobody — including the app's
  authors — sees what students do.

**Shared lab computers:** if students share a Windows login, ask them to open
Settings and click **Reset to defaults** at the end of class, which deletes
the stored key.

---

## Troubleshooting quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| "Could not connect" in Settings | Wrong address, or missing `/v1` at the end | Re-check against the board; the address must end in `/v1` |
| Connection works but generating fails or hangs | Server overloaded, or model too large | Wait and retry; stagger the class; ask for a smaller model |
| "Request failed: 401" | Secret key missing or mistyped | Re-paste the key in Settings and Save |
| Windows blocks the installer | Normal for unsigned free software | "More info" → "Run anyway" |
| A student's laptop can't reach the server at all | Network restrictions | Fallback: free Groq account (Part 2) |
| Everything is just very slow | A whole class on one server | Expected — the server answers a few requests at a time and **queues the rest**, so simultaneous generation multiplies waits. Stagger the class, use the reflection tasks, consider moving volunteers to Groq |
