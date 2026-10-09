# Development prompts and iterations

This is a truthful, curated record of meaningful prompts in the development conversation, not a complete raw transcript. Participant names in sample chats are fictional. No private conversation exports or credentials are committed.

## User prompts that shaped the project

1. The user asked for a beginner-friendly execution plan for their first hackathon and authorized technical implementation, simple explanations, browser/software use, debugging and deployment throughout this chat.
2. The user stated that submission requires a public GitHub repository, a deployed project, a brief introduction and a disclosure of all generative AI used.
3. The user supplied the official challenge slide: **The Unread Problem — “What Did I Miss?”** and instructed: **“okay now we begin, lock in”**.
4. The user confirmed they were working alone and had four hours remaining, with progress checkpoints requiring explanations of the solution, tools and logic.
5. The user asked: **“so tell me the plan, what are we exactly doing, ask me questions related to the problem statement”**.
6. Asked for the primary benefit, the user selected **“Understand the whole conversation quickly.”** This shifted the brief toward conversation context and decisions, with tasks as supporting information.
7. The user supplied a comprehensive implementation brief beginning **“ROLE: Elite Hackathon Winner, Senior Full-Stack Engineer, AI Architect, Product Designer, and Beginner Mentor.”** It required an actual tested application, local-first processing where feasible, truthful distinction between rules and AI, owners/deadlines, task completion, three test conversations, GitHub/deployment preparation, and presentation coaching.

## Engineering iterations performed by Codex

- Chose a dependency-free browser application to reduce setup and deployment risk.
- Implemented real parsing and classification over the supplied input; sample data goes through the same engine as user-provided conversations.
- Added source links and transparent rules so users can verify important findings.
- Added date interpretation, owner extraction, manual task completion and opt-in local saving.
- A held-out conversation exposed venue-change wording that the initial rules missed and a ranking issue where a tentative deadline could outrank explicitly urgent content. The rules were corrected and the processing suite passed.
- The initial DistilBART model download encountered a network error. The current implementation uses smaller local FLAN-T5 Small weights. This change is a reliability tradeoff, not a claim that the smaller model has stronger summary quality.
- Added chunked summarization and explicit coverage counts rather than silently truncating a long conversation.
- The user briefly requested an OpenRouter replacement, then instructed us to retry local inference. No OpenRouter integration or key was added. FLAN-T5 Small completed actual browser inference, but its sample summary was too vague, so the source-backed brief is now preserved alongside the experimental AI overview, including in exported briefs.

## Runtime prompt sent to the local model

```text
Summarize this group conversation, including the main decisions and important updates:
[one section of the user's conversation]
Summary:
```

The prompt is executed on-device through a Web Worker. The app does not send this prompt or conversation to ChatGPT, Codex, Hugging Face inference providers, or another cloud AI endpoint. ChatGPT/Codex were used during development, not as the app's runtime chat-processing backend.

## Verification integrity

Claims in `TESTING.md` must refer to actual executed checks. Model availability, cached offline inference, and summary accuracy must not be inferred solely from generated code. The public repository will be updated if any additional AI tool is used.
