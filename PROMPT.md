# Actual prompts and acceptance checks

This is a curated record of actual prompts, not a complete transcript. Quotes below came from this hackathon chat or the participant's attached brief. The acceptance checklist was authored during final optimization; it is not claimed as a historical prompt. Judging weights supplied by the participant are **inferred**, not confirmed official weights. Private exports and credentials are excluded.

## Actual development instructions

The attached brief began:

```text
# ROLE: Elite Hackathon Winner, Senior Full-Stack Engineer, AI Architect, Product Designer, and Beginner Mentor

You are my autonomous hackathon development partner. Act with the judgment of an experienced hackathon winner who has built and shipped successful projects under severe time constraints.

Your responsibilities include product strategy, software architecture, UI/UX design, implementation, debugging, testing, documentation, GitHub preparation, and presentation coaching.
```

It also explicitly instructed:

```text
Do not stop after generating code. Continue through execution, debugging, functional verification, and submission preparation wherever your tools and permissions allow.
Do not claim something works unless it has actually been tested.
```

The participant supplied the challenge **The Unread Problem — What Did I Miss?**: help users understand and prioritize overwhelming chat conversations, including summaries, decisions, actions, urgency, mentions and deadlines. Local-first processing was a possible focus. Their chosen main benefit was exactly:

```text
Understand the whole conversation quickly
```

## Actual refinement prompts

| Participant wording | Implemented response |
|---|---|
| `try using local model again` | Optional browser-local FLAN-T5 Small, without a cloud chat API or key. |
| `look at what AI summary looks like` | Observed repeated output; corrected parser/input, added generation controls and heuristic output rejection. |
| `revamp the UI/UX inspired by the attached reference Image` | Yellow canvas, black outlines, offset shadows and warm-white cards using native CSS. |
| `I have manually updated the code a bit. catchup to the updated code before continueing the development` | Inspected and continued from the updated local source. |
| `just fix the functionality and give a clean summary of what i post as text, also polish any UI ux inconsistency you find and clear clutter, make it feel personlised to the user` | Short source-backed excerpts, personal mentions first, deduplication, completion-aware briefs and collapsed details. |
| `remove whatsapp web help feature completely and quickly` | Removed the helper, extension, message bridge and import interface. |

The final request prioritized actual prompt evidence, working journeys, unique value, security, documentation and meaningful history, and explicitly rejected major rewrites. This pass fixed sample-name substitution, sample date preferences, hidden validation, worker startup recovery, export link attachment and restored deadline clocks.

## Exact current runtime prompt

From `dist/ai-worker.js`, executed for each selected section:

```js
`Summarize the following text in one or two sentences:\n\n${chunks[i]}`
```

`chunks[i]` contains conversation data. The model is `Xenova/flan-t5-small`, with pinned `@huggingface/transformers@4.2.0`, q8 CPU/WASM in a Web Worker. Actual settings: `max_new_tokens: 80`, `num_beams: 1`, `do_sample: false`, `repetition_penalty: 1.15`, `no_repeat_ngram_size: 3`.

The small model uses a short summarization instruction. Surrounding code enforces about 250-word sections, a 6,000-word budget, disclosed coverage, retained source evidence and rejection of unusable output. No elaborate structured-output prompt is claimed. Chat data is not sent to ChatGPT/Codex or a remote inference service by this app.

## Requirements and constraints for the final build

- Accept pasted prose and local `.txt` exports; preserve multiline announcements and tolerate imperfect input.
- Give a concise overall brief with personal mentions, decisions and actions linked to original messages.
- Use real input processing for samples and user text. Never substitute hardcoded results.
- Preserve written deadlines; mark tentative dates and unknown owners instead of inventing certainty.
- Process chats locally. No backend chat endpoint, analytics, cloud database or API key.
- Local saving is opt-in and unencrypted; disclose it and allow removing the saved copy.
- Escape chat markup; keep credentials and private exports out of Git.
- Keep the source-backed brief when optional AI fails. Heuristic rejection is not factual verification.
- Preserve the participant's design and meaningful commits; avoid unnecessary dependencies/features.

## Acceptance checks actually executed

| Requirement | Evidence |
|---|---|
| Exports, multiline input, unread ranges, owners, bounded names and dates | Engine and date tests |
| Concise personal brief, deduplication, completion and matching export | `tests/brief.test.mjs` |
| Empty input, hidden settings, literal names, sample dates, mobile focus and reduced motion | `tests/app-flow.test.mjs`, actual controller executed with a DOM adapter |
| Worker failure retains source brief and enables retry | Controller-flow test |
| Download link attached/removed and restored clock refreshed | Controller-flow tests; browser download completion remains unverified |
| Repetition, instruction echoes, unsupported numbers and failed chunks | `tests/summary-quality.test.mjs` |
| Critical request retained at end of large input | Robustness test: 196,975 characters / 3,001 messages |

Final local run: **45 tests passed, 0 failed**. DOM-adapter tests verify event wiring/state, not rendered mobile layout. Previous actual Brave checks verified sample processing, personal filters, task completion, source navigation and rejection of unusable real model output. See `TESTING.md` for release checks and remaining limits. Accepted AI text can still omit facts or be wrong.

## AI disclosure and provenance

ChatGPT/Codex assisted development, debugging, tests and documentation. FLAN-T5 Small is the only implemented generative runtime model. An earlier DistilBART download failed. OpenRouter was considered at the participant's request and abandoned before integration; no key was added. No generated image assets were used. `PROMPTS.md` retains the longer historical iteration record.
