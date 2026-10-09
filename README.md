# CatchUp AI — Your Conversations, Decoded

CatchUp helps students understand an unread group conversation quickly, then see the decisions, tasks, deadlines and mentions that need attention. Every important finding links back to its source message. Built by Adyan Malick at ProtocolX, BMSIT&M, 9 October 2026.

## Try it

Open the [live CatchUp demo](https://catchup-protocolx.vercel.app). The source repository is [Adiboi18/catchup-protocolx](https://github.com/Adiboi18/catchup-protocolx). The production URL returned HTTP 200 without authentication and served the CatchUp page.

1. Open the app and select **Try a sample chat**, or paste a chat / upload a plain-text export.
2. Enter your name and optionally choose the first unread message.
3. Select **Catch me up**. Read your source-backed brief, with personal mentions first and the broader conversation underneath.
4. Expand **Explore tasks, decisions & deadlines** to use the **For you**, **Decisions**, **Deadlines**, **Tasks**, or **Needs attention** filters.
5. Mark a task complete. Optionally enable **Remember this chat on this device**.
6. Expand **Optional AI overview** and select **Try local AI** for an experimental generative overview. First use downloads approximately 95 MB of model weights, plus runtime files. Unusable output is hidden while the source-backed brief stays available. No chat text is sent to an AI API.

## Features

- Plain-text paste and WhatsApp-style Android/iOS `.txt` exports; realistic fictional sample input.
- Concise source-backed overview covering decisions, important updates, explicitly urgent requests and recent tasks. Long announcements are abridged, with original evidence one click away.
- Personal greeting and catch-up title using the entered name; matching mentions appear in a dedicated **For you** section. Completing a task updates both the brief and task counts.
- Local keyword topic hints, clearly distinct from generative topic understanding.
- Task owners where explicitly identifiable; otherwise **Not specified / not confirmed**.
- Explicit deadlines, configurable current date/time and day-first/month-first date interpretation.
- Tentative date interpretations visibly marked; no fabricated precise deadline for ambiguous messages.
- Explainable priority ranking and source-message links.
- Task completion, filters, local Markdown brief export.
- Optional browser-local saving of chat, preferences and task completion.
- Cached app shell for offline core use after initial visit. Offline generative AI support is not guaranteed.
- Optional in-browser FLAN-T5 Small summaries. Core extraction does not require model download.

## Architecture

```text
Paste / local .txt file
        ↓
Parse messages → choose unread range
        ↓
Rules: decisions / requests / mentions / deadlines / owners
        ↓
Date resolution + transparent priority scoring
        ↓
Extractive overview + dashboard + source evidence
        └→ Optional local model in a Web Worker → generative summary
```

The stack is deliberately small: HTML, CSS, native JavaScript modules, a service worker, and an optional [Transformers.js](https://huggingface.co/docs/transformers.js/) runtime. No framework, package installation, backend, cloud chat database, login or API key is needed.

### Actual processing logic

`dist/engine.js` parses timestamps and senders, classifies messages using explicit language patterns, finds bounded name matches, identifies directly named task owners and constructs a source-backed brief. `dist/dates.js` resolves dates using the source timestamp where available and marks tentative assumptions.

Priority score: stated urgency **+7**, direct mention **+5**, stated deadline/time **+3**, request/commitment **+2**, decision/change **+2**, explicit importance **+1**, confirmed overdue deadline **+6**, confirmed deadline today/within 24 hours **+2**, only tentative date interpretations **−2**. Higher scores appear first; ties use source order. These are engineering heuristics, not learned priority probabilities.

The optional worker runs [`Xenova/flan-t5-small`](https://huggingface.co/Xenova/flan-t5-small), an ONNX conversion of Google's FLAN-T5 Small, through pinned `@huggingface/transformers@4.2.0`, using quantized q8 weights and CPU/WASM. Inputs are divided into 250-word sections and processed locally. A heuristic gate rejects repetitive or poorly grounded output; if a section fails, the entire AI overview is hidden. This is not factual verification: accepted summaries can still omit details or make mistakes. The source-backed brief remains available and is never relabelled as generated AI.

All readable messages are considered up to a 6,000-word AI budget. For longer conversations, important messages are selected first and the UI reports how many messages were covered. The extraction engine still examines the entire accepted input.

## Run locally

Install a current Node.js release if needed, then run:

```sh
node server.mjs
```

Open `http://127.0.0.1:4173`. There are no npm dependencies to install. The optional AI model needs internet on first use and sufficient browser memory.

Run processing tests:

```sh
node --test tests/*.test.mjs
```

For static hosting, serve `dist/`. The included `vercel.json` configures Vercel to serve this directory directly, with no framework, package installation or build step. `server.mjs` is only the local preview server. The root `index.html` redirects to `dist/` for optional GitHub Pages branch deployments; `.nojekyll` disables Jekyll processing.

The live demo was deployed to Vercel production by direct upload through the official Vercel CLI. The GitHub repository is not connected to Vercel, so future GitHub pushes do **not** automatically deploy. After changing the app, redeploy the current files separately through Vercel. See `TESTING.md` for the verification record.

## Privacy and its limits

Our app code reads files and processes chats in the browser. No conversation upload endpoint, chat API call or analytics SDK is implemented. Results are rendered as text, not executable chat-provided HTML. Optional model loading makes ordinary GET requests for model/runtime files to Hugging Face and jsDelivr; those services receive connection metadata such as IP addresses, not chat text from our processing code.

Chat saving is off by default. If enabled, raw chat, name, settings and completion states are stored in localStorage. This is not encrypted: anyone with access to that browser profile could access it. **Forget saved chat** removes the saved copy while preserving the current in-memory session. Export creates a local file only when requested.

These are implementation properties supported by source inspection and functional tests, not a claim of a formal security audit or supply-chain guarantee. See `TESTING.md` for verified versus untested behavior.

## AI disclosure

| Tool/model | Use |
|---|---|
| OpenAI ChatGPT / Codex | Product discussion, engineering, code generation, debugging, tests, documentation and presentation coaching in this chat |
| Google FLAN-T5 Small (`Xenova/flan-t5-small`) | Optional generative summaries running locally in the user's browser |

No other generative AI tools have been used for the submitted project at this stage. Brave, GitHub, Node.js and Transformers.js are software tools, not additional generative AI models. See `PROMPTS.md` for meaningful prompts and iterations.

## Limitations

- English-first rules and model; slang, sarcasm, indirect instructions and other languages may be missed.
- Exact name matching does not automatically infer nicknames or every pronoun.
- The website does not connect to chat accounts or read other applications. Input is supplied by text paste or local .txt upload.
- Rules do not reliably resolve every negation, contradiction or superseded decision; verify source evidence.
- Tasks are completed manually; completion messages are not matched semantically to earlier tasks.
- Relative dates without reliable timestamps are tentative. All dates use the device's local timezone.
- AI summaries are experimental, may be incomplete, and have a disclosed input budget. Cold-start downloading and memory usage can be substantial.
- Local storage is browser-specific. Offline generative behavior, accessibility conformance and all device/browser combinations have not been comprehensively audited.

Future improvements: better conversation segmentation, correction/supersession handling, multilingual extraction, stronger local models with smaller downloads, a deadline confirmation flow and user-defined name aliases.

See `TESTING.md`, `PROMPTS.md`, and `JUDGING.md` for validation, development disclosure and the live demo.
