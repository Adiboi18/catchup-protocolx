# Demo and checkpoint notes

## 30-second introduction

CatchUp helps students understand a busy group chat quickly. Paste or upload a chat and get a source-backed brief, decisions, deadlines and tasks. Every important finding shows why it was prioritized and links to the original message. Optional AI runs locally; chat text is not sent to a cloud AI service.

## How it works in simple words

1. **Separate the messages:** recognize the speaker and timestamp in common chat exports.
2. **Find signals:** look for wording such as “we decided,” “please send,” a named person, or a deadline.
3. **Sort what matters:** explicit urgency, your name and confirmed deadlines increase priority. Explain the reason beside each result.
4. **Keep the evidence:** quote selected messages for the brief and provide source links. Dates or owners that are not certain are marked.
5. **Add an optional AI overview:** a small downloaded model writes a shorter overview on the device. Keep the source-backed facts alongside it because the model can miss details.

## Two-minute demo

- **0:00–0:20:** Describe missing a venue change or deadline in hundreds of messages.
- **0:20–0:45:** Load the fictional sample, enter Adyan, select Catch me up. Point to the library venue decision and the slide deadline.
- **0:45–1:05:** Select For you, open a source link and show exactly which message supports the finding.
- **1:05–1:25:** Mark a task completed, hide completed tasks, explain tentative owners/dates.
- **1:25–1:45:** Show local AI if preloaded. Explain that it adds an experimental overview and does not replace evidence. If download/inference fails, demonstrate the working extractive brief.
- **1:45–2:00:** Export the brief; show GitHub, test results and the live link. State the model's observed quality limits openly.

## Checkpoint update

“We have implemented real chat parsing, summaries based on original messages, decisions, task owners, date interpretation, explainable priorities and source links. Task completion and optional local saving work. A small local AI model has generated actual summaries in Brave, but it can omit details, so we retain the source-backed brief. We are testing edge cases and preparing a public repository and deployment.”

## Five likely questions

**Is everything AI?** No. Parsing, deadlines and priorities use explicit rules. FLAN-T5 Small generates the optional overview. Codex helped develop the code, tests and documentation.

**Does private chat leave the device?** Our processing code makes no chat upload or cloud inference calls. Downloading model/runtime files exposes normal connection metadata to the download providers. Optional browser saving is unencrypted and can be cleared.

**What stops hallucinations?** Nothing guarantees that the model never makes mistakes. We retain source-backed facts and evidence links, mark uncertain date/owner interpretations, and label the AI overview experimental.

**Does it handle unseen chats?** Additional research and logistics conversations are included. Tests cover these and a long conversation with an urgent message at the end. English rules still miss indirect wording and sarcasm.

**Why a small local model?** It avoids runtime API keys and cloud chat transmission and is practical on this laptop. The tradeoff is a first-use download and weaker summary quality. Core extraction works even if AI fails.
