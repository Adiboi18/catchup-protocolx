# Verification record

Executed on Windows in Brave, 9 October 2026. These results describe the local prototype; public deployment has not yet been verified.

## Automated processing checks

`node --test tests/*.test.mjs`: **18 passed, 0 failed**. Covers Android/iOS exports, time-first WhatsApp Web timestamps and multiline messages, name boundaries, priority order, unread ranges, deadline wording, negated urgency/completed-work cases, raw markup handling, AI input/export, relative dates, invalid dates/date formats, and two additional conversations with owners and uncertain dates. AI export retains the source-backed brief. A 196,975-character / 3,001-message fixture retained an urgent request at its end; analysis took approximately 32–35 ms on this machine. This is not a cross-device performance guarantee.

`node --check dist/app.js`: passed.

## Actual browser checks

- Fictional sample: 18 messages, 6 initial tasks and 3 decisions; filters and source navigation worked.
- Marking task #13 completed reduced open tasks to 5; hiding completed tasks and selecting For you preserved the remaining slide request.
- Opt-in browser saving and reload restored the sample and completion state.
- Actual FLAN-T5 Small generation completed in the browser on the 18-message sample. Selecting Summarize again completed again. After reloading the updated view, actual generation completed and the app showed the experimental overview **and** the source-backed facts together.
- Model quality limitation observed: the generated overview was “The final decision is to prepare the materials for the workshop.” It omitted the venue and deadlines. Successful generation is not proof of accurate or comprehensive summarization. Source-backed facts remain visible and included in exports.

## Not verified yet

Offline model inference, fresh-device cold-start performance, upload/download UI flows, responsive layouts, comprehensive accessibility, every browser/device, and public deployment. No cloud AI endpoint or API key was added. The optional WhatsApp helper is an unverified adapter prototype; parser tests do not prove actual WhatsApp integration.

## WhatsApp helper prototype

Three simulated adapter tests passed: confirmed-chat text extraction, quote/nested-link exclusion, failure on a wrong chat, and rejection of another extension sender. Real WhatsApp Web page structure was inspected for the selected group, and selector discrepancies were corrected. This is not an end-to-end import verification. Installing the helper is awaiting user action because automated access to Brave extension settings was blocked.

