# Verification record

Executed on Windows in Brave, 9 October 2026. Current local checks and previous public-hosting checks are distinguished below. Fixtures in this repository are fictional.

## Current automated checks

`node --test tests/*.test.mjs`: **42 passed, 0 failed**.

Coverage includes Android/iOS and time-first WhatsApp exports, multiline announcements and links, bounded name matching, unread ranges, named dates, dot-times, ambiguous dates, explicit urgency, task completion language, owner extraction, markup handling and the helper's exact-origin boundary. New regressions cover recent instructions competing with old overdue announcements, model-input noise, long announcement excerpts, personalized and deduplicated briefs, completion-aware brief selection, plain prose and matching exported facts.

Seven summary-quality tests cover the observed repeated-label/formatting failure, instruction echoes, generic output, unsupported numeric quantities, supported overviews, safe sentence deduplication and failed aggregation. These are heuristic checks, not factual verification.

A 196,975-character / 3,001-message fictional conversation retained the critical request at its end. Timing varies across runs and devices; no universal performance claim is made.

`node --check dist/app.js` and `node --check dist/ai-worker.js`: passed. `git diff --check`: passed.

## Current actual browser checks

- Opened the updated desktop interface in Brave. The input and brief render together with the reference-inspired yellow canvas, black outlines and warm-white panels.
- Tested a real exported conversation locally without committing it. Corrected parsing produced 26 entries rather than the previous 62 split entries. The source brief included the registration requirements, explicit urgency and recent class instructions.
- Actual local-model inference on that conversation hit the quality gate. The generated output was hidden, no AI overview appeared, and the view correctly retained the **Source-backed** label and explanatory status. This is a verified fallback, not a claim that model summary quality is solved.
- Entered the fictional name Sam and loaded the sample. The heading became **Sam’s catch-up**, sample mentions adapted to Sam, and **For you** contained the slide and microphone requests. The sample parsed 18 messages with 6 open tasks and 3 decisions.
- The For you filter displayed two findings. Completing task #13 reduced open tasks to 5 and removed that task from the personal brief. Hiding completed tasks left one finding. Test completion was undone.
- Source #6 expanded the original transcript and highlighted its matching message.

Brave control became unavailable during the next batch of checks. Privacy-dialog, download and additional sample-model checks from that batch are not claimed as completed. Responsive CSS is implemented, but rendered mobile verification is still pending.

## Previous public Vercel checks

The earlier production release returned HTTP 200 without login, and all seven assets in that release matched local source bytes. Sample processing, personal filtering, task completion, source navigation and FLAN-T5 generation were tested on that earlier release. Its generated summary omitted important facts, which motivated the current improvements.

The current release adds `brief.js` and `summary-quality.js`. Publication must be checked against all nine app assets with anonymous requests and byte comparison. GitHub integration is not connected; a separate direct Vercel deployment is required after source pushes.

## Remaining limits

Offline model inference, fresh-device cold-start performance, rendered mobile layout, upload/download UI flows, comprehensive accessibility and every browser/device are unverified. No cloud chat AI endpoint or API key was added.

The optional WhatsApp helper has four simulated adapter tests covering identity, quote exclusion, extension sender and exact app origin. Installing it and importing a real WhatsApp chat end-to-end remain pending; these tests do not prove actual WhatsApp integration.
