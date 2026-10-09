# Verification record

Executed on Windows in Brave, 9 October 2026. Local prototype and public Vercel production checks are distinguished below.

## Automated processing checks

`node --test tests/*.test.mjs`: **19 passed, 0 failed**. Covers Android/iOS exports, time-first WhatsApp Web timestamps and multiline messages, name boundaries, priority order, unread ranges, deadline wording, negated urgency/completed-work cases, raw markup handling, AI input/export, relative dates, invalid dates/date formats, and two additional conversations with owners and uncertain dates. AI export retains the source-backed brief. The helper origin boundary allows this app's exact production address and rejects other Vercel sites, lookalikes, unexpected protocols and ports. A 196,975-character / 3,001-message fixture retained an urgent request at its end; analysis took approximately 32–41 ms across recorded runs on this machine (40.3 ms in the latest run). This is not a cross-device performance guarantee.

`node --check dist/app.js`: passed.

## Actual browser checks

- Fictional sample: 18 messages, 6 initial tasks and 3 decisions; filters and source navigation worked.
- Marking task #13 completed reduced open tasks to 5; hiding completed tasks and selecting For you preserved the remaining slide request.
- Opt-in browser saving and reload restored the sample and completion state.
- Actual FLAN-T5 Small generation completed in the browser on the 18-message sample. Selecting Summarize again completed again. After reloading the updated view, actual generation completed and the app showed the experimental overview **and** the source-backed facts together.
- Model quality limitation observed: the generated overview was “The final decision is to prepare the materials for the workshop.” It omitted the venue and deadlines. Successful generation is not proof of accurate or comprehensive summarization. Source-backed facts remain visible and included in exports.

## Not verified yet

Offline model inference, fresh-device cold-start performance, upload/download UI flows, responsive layouts, comprehensive accessibility and every browser/device. No cloud AI endpoint or API key was added. The optional WhatsApp helper is an unverified adapter prototype; parser tests do not prove actual WhatsApp integration.

## Public Vercel production checks

Story: a visitor opens the public website, loads a conversation, gets a local brief, and follows a finding back to its original message. Optional AI also runs in the visitor's browser.

| Boundary | Executed evidence |
|---|---|
| Public access | `https://catchup-protocolx.vercel.app` returned HTTP 200 with the CatchUp title using an anonymous request, without a Vercel login. |
| Hosted assets | All seven deployed app assets returned HTTP 200 and matched local source bytes by SHA-256. |
| Input to brief | In Brave, Try a sample chat parsed 18 fictional messages, showing 6 initial open tasks, 3 decisions and 2 items needing attention. |
| Brief to evidence | For you showed the microphone and slides requests. Source #13 expanded the original transcript and focused its matching message. |
| Task state to UI | Completing #13 reduced open tasks to 5; Hide completed tasks left the slides request in For you. Test completion was then undone for the presentation. |
| Local model to UI | Use local AI completed on the deployed site, reported 18 of 18 messages processed with FLAN-T5 Small, and displayed the experimental overview alongside source-backed facts. Its output had the same omission limitation recorded above. |

Vercel reported the production deployment Ready. The application has no backend chat API or database boundary to verify; these checks cover static delivery and browser-local processing. Production was deployed by direct CLI upload; GitHub integration is not connected.

## WhatsApp helper prototype

Four simulated adapter tests passed: confirmed-chat text extraction with quote/nested-link exclusion, failure on a wrong chat, rejection of another extension sender, and the exact app-origin boundary. Real WhatsApp Web page structure was inspected for the selected group, and selector discrepancies were corrected. This is not an end-to-end import verification. Installing the helper is awaiting user action because automated access to Brave extension settings was blocked.

