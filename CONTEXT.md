# Career Compass — Context

Domain and architecture vocabulary for Career Compass. The terms below name the
seams in the LLM pipeline so suggestions, reviews, and code all use one language.

## Language

### LLM pipeline

**Feature service**:
A renderer module under `src/renderer/services/` that orchestrates one
LLM-backed feature end to end (e.g. compare, coverLetter, careers, odyssey).
_Avoid_: route handler, endpoint, controller.

**chat() client**:
The provider-agnostic LLM call in `src/renderer/services/llm.ts`. A **deep**
module: 7 providers, key sourcing, timeouts, and per-provider request/response
translation behind one small interface. Every LLM call goes through it.
_Avoid_: llm, api client, completion.

**Provider**:
One LLM backend — `ollama`, `openai`, `claude`, `groq`, `gemini`,
`openrouter`, or `custom`.
_Avoid_: vendor, model host, backend.

**Prompt builder**:
A `lib/prompts/*` module that builds the prompt text for a feature and parses
the model's reply back into a typed result. Framework-agnostic, no node-only
deps.
_Avoid_: template, formatter.

### Structured generation

**Structured generation**:
The shared core that turns an input into a typed result via the **chat()
client** — the pair `callStructured` / `generate`. Replaces the per-feature
`callOnce` + nested retry that each feature service hand-wrote.
_Avoid_: LLM helper, runner.

**callStructured**:
One attempt: build messages → `chat()` → parse. No retry. Used directly by
single-shot callers that never trim (e.g. `suggestCareers`, `suggestLife`).
_Avoid_: callOnce, invoke.

**generate**:
`callStructured` wrapped in a **trim ladder**. Returns `{ result, trimmed }`.
Used by every feature that retries on token-limit errors.
_Avoid_: run, execute.

**Trim ladder**:
The ordered list of input-shrinking steps walked when the **chat() client**
reports a token-limit error: try the input, on token-limit apply the next step
and retry, repeat until a step succeeds or the steps run out. Carries an
optional terminal message — present means throw it when exhausted, absent means
rethrow the last error. Non-token-limit errors propagate immediately.
_Avoid_: retry chain, fallback chain, backoff.

**Trimmed flag**:
The boolean a **generate** call returns to tell the UI the input was shrunk to
fit, so it can show a "your input was trimmed" notice.
_Avoid_: truncated, degraded.

### Model output

**Model JSON**:
The JSON text a **provider** returns — often wrapped in ``` fences, sometimes
malformed. `parseModelJson` strips the fences and parses it; it throws only on
invalid JSON, never on a missing field.
_Avoid_: response, payload, completion.

**Coercer**:
A lenient mapper (`toString`, `toStringArray`, `toRecord`) that reads a field
out of parsed **Model JSON**, substituting a default when the field is missing
or the wrong type. Leniency is deliberate: model output is unreliable, so a
feature degrades rather than fails.
_Avoid_: validator, guard (those imply throwing).

### Main process

**Provider module**:
The main-process module (`src/main/services/providers.js`) that lists models
and tests connections per **provider**, behind an injected `fetch` so it can be
tested without live network. Distinct from the **chat() client**, which runs in
the renderer and only sends chat turns.
_Avoid_: provider service, llm main.

## Example dialogue

**Dev:** The cover-letter feature service was timing out on long resumes.

**Expert:** That's the trim ladder doing its job — first step trims the job
advert, second trims the resume. If both steps still hit a token-limit error it
throws the ladder's terminal message.

**Dev:** And the chat advisor? It only has one step.

**Expert:** Right — its ladder trims history to the last 20 turns, and if the
retry still fails there's no terminal message, so the original error just
propagates. Both go through `generate`; only the ladder differs.

**Dev:** Where does the JSON parsing live now?

**Expert:** The prompt builder still owns parsing, but it leans on
`parseModelJson` to strip the fences and on the coercers to read each field
leniently. A missing `whyItsagoodfit` becomes `[]`, not an error.
