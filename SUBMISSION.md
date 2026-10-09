# Submission checklist and evaluation mapping

Transcribed from the organizer's slides supplied on 9 October 2026. No numerical scoring weights or submission-platform URL were shown/provided.

## Required submission fields

- GitHub repository link: https://github.com/Adiboi18/catchup-protocolx — must contain the submitted source and be public.
- Deployed project link: add the verified live URL before submission; localhost is not a deployment.
- Brief project description: use the introduction below.
- Clearly state which GenAI services/models were used and where: use the disclosure below and README/PROMPTS.md.

## Brief description

CatchUp is a browser app that turns unread group conversations into a quick, source-backed brief with decisions, tasks, deadlines and mentions. Explainable priorities help users decide what needs attention. Optional FLAN-T5 Small inference runs on the device, while original evidence remains visible. Built for the ProtocolX “What Did I Miss?” challenge.

## GenAI disclosure

OpenAI ChatGPT/Codex was used for ideation, code generation, debugging, tests, documentation and presentation coaching. Google's FLAN-T5 Small, via Xenova's ONNX conversion and Transformers.js, generates the optional runtime overview locally in the browser. A DistilBART download was attempted during development but did not run. OpenRouter was considered and then cancelled; no OpenRouter key or inference call is implemented.

## Evaluation areas

| Organizer area | Implementation and evidence |
|---|---|
| Code quality | Formatted modules separate parsing/ranking, date logic, UI and model worker; small dependency-free core; README architecture and documented limits. |
| Security | Chat input rendered with textContent; no cloud chat endpoint or embedded API key; constrained content policy; opt-in local saving and Forget saved chat. Malicious markup tested as text. |
| Efficiency | Model loaded only on request in a worker; bounded/chunked model input; deterministic core works without downloading a model. Long-conversation processing benchmark is recorded in TESTING.md. |
| Testing | Node processing/edge-case tests, three conversation fixtures and actual browser flow checks; limitations and unverified checks reported. |
| Accessibility | Explicit labels, keyboard-operated upload, visible focus, skip link, named dialog, status announcements, reduced motion and readable secondary text. Not a claim of formal WCAG certification. |
| Problem-statement alignment | Brief answers “what did I miss?” before tasks; includes decisions, deadlines, mentions, urgency, evidence and optional local AI. |

The slides say platform code assessment is automatic, challenge scores count toward the leaderboard, warm-up scores do not count, and only the **final** submission score for the phase is used (not the best attempt). Do not leave an incomplete last attempt.

The platform's exact field limits and final submission workflow remain unknown until organizers provide the URL.
