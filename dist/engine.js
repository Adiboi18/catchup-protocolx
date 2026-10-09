import { resolveDeadline } from './dates.js';
import { buildBrief } from './brief.js';

export const SAMPLE_CHAT = `[09/10/2026, 09:00] Maya: Morning team! Let’s finish planning the campus workshop today.
[09/10/2026, 09:02] Rohan: Morning! The weather is finally good.
[09/10/2026, 09:03] Leena: Anyone tried the new cafeteria coffee?
[09/10/2026, 09:05] Maya: We have decided to hold the workshop in the library hall, not room 204.
[09/10/2026, 09:07] Rohan: Great, that has more space.
[09/10/2026, 09:10] Leena: @Adyan please send the final presentation slides by 2 PM today. We need them for the projector test.
[09/10/2026, 09:12] Maya: Important: registration closes at 5 PM today. Please remind your classmates.
[09/10/2026, 09:15] Rohan: I can bring the extension cables.
[09/10/2026, 09:18] Leena: The poster looks great!
[09/10/2026, 09:20] Maya: We agreed to keep entry free for all students.
[09/10/2026, 09:23] Rohan: I’ll handle the registration desk tomorrow.
[09/10/2026, 09:25] Leena: Does anyone have spare markers?
[09/10/2026, 09:28] Maya: @Adyan can you confirm whether the microphone works? This is urgent; the sound check is blocked.
[09/10/2026, 09:30] Rohan: Here’s the location pin. <Media omitted>
[09/10/2026, 09:33] Leena: The workshop starts at 10 AM tomorrow. Volunteers should arrive by 9:30 AM.
[09/10/2026, 09:36] Maya: Please bring your college ID and a water bottle.
[09/10/2026, 09:38] Rohan: Thanks, see you all there!
[09/10/2026, 09:40] Leena: One last thing: the budget is approved. We’re using the department’s projector.`;

const DATE = String.raw`\d{1,4}[\/.\-]\d{1,2}[\/.\-]\d{1,4}`;
const TIME = String.raw`\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?`;
const bracketed = new RegExp(`^\\[(${DATE}),?\\s+(${TIME})\\]\\s*([^:]+):\\s*(.*)$`);
const webBracketed = new RegExp(`^\\[(${TIME}),?\\s+(${DATE})\\]\\s*([^:]+):\\s*(.*)$`);
const whatsapp = new RegExp(`^(${DATE}),?\\s+(${TIME})\\s*[-–]\\s*([^:]+):\\s*(.*)$`);
const timed = new RegExp(`^\\[?(${TIME})\\]?\\s+([^:]+):\\s*(.*)$`);
const plain = /^([\p{L}\p{N}_ @+().\-]{1,55}):\s*(.*)$/u;
const systemLine = new RegExp(`^\\[?${DATE},?\\s+${TIME}\\]?\\s*[-–]?\\s*(.+)$`);

export function parseChat(input) {
  const messages = [];
  const lines = String(input)
    .replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '')
    .split(/\r?\n/);
  // In an export, only a timestamp begins a message. Labels and URLs inside
  // announcements ("Venue:", "https:") are content, not new sender names.
  const timestamped = lines.some((raw) => {
    const line = raw.trim();
    return (
      bracketed.test(line) ||
      webBracketed.test(line) ||
      whatsapp.test(line) ||
      timed.test(line) ||
      systemLine.test(line)
    );
  });
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (
      timestamped &&
      !messages.length &&
      /^Messages and calls are end-to-end encrypted\.(?: No one outside of this chat(?:, not even WhatsApp,)? can read(?: or listen to)? them\.)?$/i.test(
        line,
      )
    )
      continue;
    const webMatch = line.match(webBracketed);
    if (webMatch) {
      messages.push({
        id: messages.length + 1,
        date: webMatch[2],
        time: webMatch[1],
        sender: webMatch[3].trim(),
        text: webMatch[4],
      });
      continue;
    }
    let match = line.match(bracketed) || line.match(whatsapp);
    if (match) {
      messages.push({
        id: messages.length + 1,
        date: match[1],
        time: match[2],
        sender: match[3].trim(),
        text: match[4],
      });
      continue;
    }
    match = line.match(timed);
    if (match) {
      messages.push({
        id: messages.length + 1,
        date: '',
        time: match[1],
        sender: match[2].trim(),
        text: match[3],
      });
      continue;
    }
    match = line.match(systemLine);
    if (match) {
      messages.push({
        id: messages.length + 1,
        date: '',
        time: '',
        sender: 'System',
        text: match[1],
        system: true,
      });
      continue;
    }
    match = !timestamped && line.match(plain);
    if (match) {
      messages.push({
        id: messages.length + 1,
        date: '',
        time: '',
        sender: match[1].trim(),
        text: match[2],
      });
      continue;
    }
    const previous = messages.at(-1);
    if (previous && (timestamped || previous.date || previous.time)) previous.text += '\n' + line;
    else
      messages.push({ id: messages.length + 1, date: '', time: '', sender: 'Message', text: line });
  }
  return messages;
}

const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function mentionsName(text, name) {
  if (!name.trim()) return false;
  return new RegExp(
    `(^|[^\\p{L}\\p{N}_])@?${escaped(name.trim())}(?=$|[^\\p{L}\\p{N}_])`,
    'iu',
  ).test(text);
}

export function extractDeadlines(text) {
  const month =
    '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)';
  const day = '\\d{1,2}(?:st|nd|rd|th)?';
  const namedDate = `(?:${day}(?:\\s*(?:[-–]|to)\\s*${day})?\\s+${month}(?:\\s*,?\\s*\\d{4})?|${month}\\s+${day}(?:,?\\s+\\d{4})?)`;
  const patterns = [
    /\b(?:by|before|due(?:\s+(?:on|at|by))?|deadline(?:\s+(?:is|at|on))?|closes?(?:\s+at)?|starts?(?:\s+at)?|arrive(?:\s+by)?|scheduled(?:\s+(?:for|at|on))?)\s+(?!to\b)(?:(?:\d{1,2}(?:[.:]\d{2})?\s*(?:AM|PM)\b|\d{1,2}:\d{2}|\d{1,2}[\/.\-]\d{1,2}(?:[\/.\-]\d{2,4})?|today|tomorrow|tonight|(?:next\s+)?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday))(?:\s+(?:today|tomorrow|tonight))?)/gi,
    /\b(?:by|before|due(?:\s+(?:on|at|by))?|deadline(?:\s+(?:is|at|on))?|scheduled(?:\s+(?:for|at|on))?)\s+\d{4}-\d{1,2}-\d{1,2}\b/gi,
    /\bin\s+\d+\s+(?:minutes?|hours?|days?)\b/gi,
    /\b(?:deadline|due date)\s*[:–-]\s*[^.!?\n]{1,45}/gi,
    new RegExp(
      `\\b(?:on\\s+or\\s+before|by|before|on|from|due(?:\\s+(?:on|at|by))?|deadline(?:\\s+(?:is|at|on))?|closes?(?:\\s+(?:at|on))?|starts?(?:\\s+(?:at|on))?|scheduled(?:\\s+(?:for|at|on))?|(?:event\\s+)?date)\\s*[:–-]?\\s*${namedDate}(?:\\s*(?:to|through|until|[-–])\\s*${namedDate})?\\b`,
      'gi',
    ),
    /\b\d{1,2}[.:]\d{2}\s*(?:AM|PM)\b/gi,
    /\b(?:by|before|during|in|for|on|at)\s+(?:the\s+)?next\s+class\b/gi,
  ];
  const labels = [
    ...new Set(
      patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0].trim())),
    ),
  ];
  // Prefer the full source phrase over an overlapping bare time/date fragment.
  return labels
    .filter(
      (label) =>
        !labels.some(
          (other) => other !== label && other.toLowerCase().includes(label.toLowerCase()),
        ),
    )
    .sort(
      (a, b) =>
        text.toLowerCase().indexOf(a.toLowerCase()) - text.toLowerCase().indexOf(b.toLowerCase()),
    );
}

function ownerFor(message, name, participants) {
  const known = [...new Set([name, ...participants])].filter(Boolean);
  const namedMentions = known.filter((person) =>
    new RegExp(`@${escaped(person)}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(message.text),
  );
  const mentions = namedMentions.length
    ? namedMentions
    : [...message.text.matchAll(/@([\p{L}\p{N}_]+)/gu)].map((m) => m[1]);
  if (mentions.length) return { name: mentions.join(', '), uncertain: false };
  if (
    /\bI(?:['’]ll|\s+will|\s+can)\s+(?:handle|bring|prepare|send|take|work|check|finish|submit|upload|review)/i.test(
      message.text,
    )
  )
    return { name: message.sender, uncertain: message.sender === 'Message' };
  for (const person of [...new Set([name, ...participants])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)) {
    if (
      new RegExp(
        `(^|[^\\p{L}\\p{N}_])${escaped(person)}[, :]?\\s+(?:please|can you|could you|will|needs to|should|must)`,
        'iu',
      ).test(message.text)
    )
      return { name: person, uncertain: false };
  }
  return { name: 'Not specified', uncertain: true };
}

function classify(message, name, options, participants) {
  const text = message.text;
  if (
    message.system ||
    /^<?(?:media omitted|image omitted|sticker omitted|this message was deleted)>?\.?$/i.test(
      text.trim(),
    )
  )
    return null;
  const tags = [];
  const deadlines = extractDeadlines(text);
  const mention = mentionsName(text, name);
  const completed =
    /\b(?:already|have|has|I've|we've)\s+(?:sent|submitted|finished|completed|done|uploaded|confirmed)\b|\b(?:task|work)\s+(?:is\s+)?(?:done|complete[d]?)\b/i.test(
      text,
    );
  const action =
    /\b(?:please|pls|plz)\s+(?!note\b|ignore\b)|\b(?:can|could|would)\s+(?:you|someone|anyone)\b|\b(?:need|needs)\s+to\b|\b(?:must|should|have to)\s+(?:send|submit|bring|arrive|finish|upload|confirm|check|review|prepare|complete|register|attend|solve|fill|take)\b|\b(?:requested|instructed|informed|expected|required)\s+to\b|\b(?:I|we|I['’]ll|we['’]ll)\s+(?:will\s+)?(?:handle|bring|prepare|send|submit|finish|check|take care of|work on)\b|\b(?:assigned|action item|todo|to-do)\b/i.test(
      text,
    );
  const decision =
    /\b(?:decided|agreed|approved|confirmed|finalized|finalised|cancelled|canceled|rescheduled)\b|\b(?:we['’]re|we are)\s+(?:using|going with|switching to)\b|\b(?:meeting|event|workshop|venue|deadline)\s+(?:has(?: been)?\s+|is\s+|was\s+)?(?:moved|changed|postponed)\b/i.test(
      text,
    );
  const urgent =
    /\b(?:urgent|asap|immediately|critical|blocked|blocking|emergency)\b/i.test(text) &&
    !/\b(?:not|isn't|is not|no longer)\s+(?:very\s+)?(?:urgent|critical|blocked|blocking)\b/i.test(
      text,
    );
  const announcement =
    /\b(?:date|venue|registration|event|schedule)\s*[*_]*\s*:/i.test(text) ||
    /\bregister\s+(?:here|now)\b/i.test(text);
  const important = announcement || /\b(?:important|announcement|reminder|attention)\b/i.test(text);
  if (action && !completed) tags.push('action');
  if (decision) tags.push('decision');
  if (deadlines.length) tags.push('deadline');
  if (mention) tags.push('mention');
  if (important || (!tags.length && urgent)) tags.push('update');
  if (!tags.length) return null;
  const score =
    (urgent ? 7 : 0) +
    (mention ? 5 : 0) +
    (deadlines.length ? 3 : 0) +
    (tags.includes('action') ? 2 : 0) +
    (decision ? 2 : 0) +
    (important ? 1 : 0);
  const priority =
    urgent || (mention && deadlines.length)
      ? 'high'
      : deadlines.length || mention || tags.includes('action')
        ? 'medium'
        : 'normal';
  const deadlineDetails = deadlines.map((label) => resolveDeadline(label, message, options));
  const overdue = deadlineDetails.some((d) => d.status === 'overdue' && !d.uncertain);
  const soon = deadlineDetails.some((d) => ['soon', 'today'].includes(d.status) && !d.uncertain);
  const tentative = deadlineDetails.length && deadlineDetails.every((d) => d.uncertain);
  return {
    ...message,
    tags,
    deadlines,
    deadlineDetails,
    owner: tags.includes('action') ? ownerFor(message, name, participants) : null,
    score: score + (overdue ? 6 : soon ? 2 : 0) - (tentative ? 2 : 0),
    priority: overdue ? 'high' : !urgent && tentative && priority === 'high' ? 'medium' : priority,
    reasons: [
      ...(urgent ? ['Urgency stated in message'] : []),
      ...(mention ? ['Mentions your name'] : []),
      ...(overdue
        ? ['Explicit deadline has passed']
        : soon
          ? ['Deadline is today or within 24 hours']
          : deadlines.length
            ? [tentative ? 'Time or date needs confirmation' : 'Contains a stated time or deadline']
            : []),
      ...(tags.includes('action') ? ['Contains a request or commitment'] : []),
      ...(decision ? ['Records a decision or change'] : []),
    ],
  };
}

export function analyzeChat(input, name = '', unreadFrom = 1, options = {}) {
  const allMessages = parseChat(input);
  const from = Math.max(1, Math.floor(Number(unreadFrom) || 1));
  const messages = allMessages.filter((message) => message.id >= from);
  const participants = allMessages
    .map((m) => m.sender)
    .filter((s) => !['System', 'Message'].includes(s));
  const findings = messages
    .map((message) => classify(message, name, options, participants))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.id - b.id);
  const chosen = new Map();
  const addBrief = (item) => {
    if (item && chosen.size < 9) chosen.set(item.id, item);
  };
  findings
    .filter((item) => item.tags.includes('mention'))
    .slice(0, 2)
    .forEach(addBrief);
  addBrief(findings.find((item) => item.reasons.includes('Urgency stated in message')));
  findings
    .filter((item) => item.tags.includes('action'))
    .sort((a, b) => b.id - a.id)
    .slice(0, 2)
    .forEach(addBrief);
  findings
    .filter((item) => item.tags.includes('decision'))
    .slice(0, 3)
    .forEach(addBrief);
  addBrief(findings.find((item) => item.priority === 'high'));
  findings
    .filter((item) => item.tags.includes('deadline'))
    .slice(0, 3)
    .forEach(addBrief);
  findings
    .filter((item) => item.tags.includes('update'))
    .slice(0, 2)
    .forEach(addBrief);
  if (!chosen.size) findings.slice(0, 4).forEach(addBrief);
  const summaryMessages = chosen.size
    ? [...chosen.values()].sort((a, b) => a.id - b.id)
    : messages.filter((message) => !message.system && message.text.length > 20).slice(-4);
  const words = messages.reduce(
    (count, message) => count + message.text.split(/\s+/).filter(Boolean).length,
    0,
  );
  const stops = new Set(
    'the and for that this with have from your you are will can please today tomorrow need them they their all has our not was just what when there here one should we its using been send also about would could were into then than does did done let lets everyone thanks important urgent by she him her said know morning anyone someone great good looks thing last final bring can hold agreed decided approved confirm whether works closes starts arrive college bottle water spare tried finally more space handle free entry keep need omitted media note attention forwarded message messages http https notice'.split(
      ' ',
    ),
  );
  const names = new Set([...participants, name].join(' ').toLowerCase().split(/\s+/));
  const frequencies = new Map();
  for (const token of messages
    .filter((m) => !m.system)
    .map((m) =>
      m.text
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/<[^>]*omitted>|<message_history_notice message>/gi, ''),
    )
    .join(' ')
    .toLowerCase()
    .match(/[a-z]{4,}/g) || [])
    if (!stops.has(token) && !names.has(token))
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
  const topics = [...frequencies]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word);
  return {
    allMessages,
    messages,
    findings,
    summaryMessages,
    unreadFrom: from,
    name,
    topics,
    options,
    wordCount: words,
    readMinutes: Math.max(1, Math.ceil(words / 180)),
    stats: {
      urgent: findings.filter((item) => item.priority === 'high').length,
      tasks: findings.filter((item) => item.tags.includes('action')).length,
      decisions: findings.filter((item) => item.tags.includes('decision')).length,
    },
  };
}

export function buildAIInput(digest) {
  const normalize = (text) =>
    String(text)
      .replace(/\[Forwarded(?: many times)?\]\s*/gi, '')
      .replace(/<message_history_notice message>/gi, '')
      .replace(/\[([^\]\n]+)\]\(\s*https?:\/\/[^\s)]+\s*\)/gi, '$1')
      .replace(/\[([^\]\n]+)\](?=\s*https?:\/\/)/gi, '$1')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/(^|\s)[*_~`]+|[*_~`]+(?=\s|$|[.,:;!?])/g, '$1')
      .replace(
        /^\s*(?:forwarded(?: many times)?|<?(?:media omitted|image omitted|sticker omitted|this message was deleted)>?)\s*[:.]?\s*$/gim,
        '',
      )
      .replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '')
      .split(/\n/)
      .map((line) => line.trim().replace(/[ \t]+/g, ' '))
      .filter(Boolean)
      .join('\n');
  const usable = digest.messages
    .filter((message) => !message.system)
    .map((message) => {
      const content = normalize(message.text);
      const sender =
        message.sender && message.sender !== 'Message' && !/^\+?[\d\s()-]{7,}$/.test(message.sender)
          ? `${message.sender}: `
          : '';
      return { ...message, modelText: content ? sender + content : '' };
    })
    .filter((message) => message.modelText);
  const byId = new Map(usable.map((message) => [message.id, message]));
  // Preserve the most relevant evidence first, then restore conversation order.
  const totalWords = usable.reduce(
    (sum, message) => sum + message.modelText.split(/\s+/).length,
    0,
  );
  const prioritized =
    totalWords <= 6000
      ? usable
      : [...digest.findings.map((message) => byId.get(message.id)).filter(Boolean), ...usable];
  const selected = new Map();
  let words = 0;
  for (const message of prioritized) {
    if (selected.has(message.id) || message.system) continue;
    const count = message.modelText.split(/\s+/).length;
    if (words + count > 6000) continue;
    selected.set(message.id, message);
    words += count;
  }
  if (!selected.size && usable.length) {
    const first = usable[0];
    if (first)
      selected.set(first.id, {
        ...first,
        modelText: first.modelText.split(/\s+/).slice(0, 450).join(' '),
      });
  }
  const units = [...selected.values()]
    .sort((a, b) => a.id - b.id)
    .map((message) => message.modelText);
  const text = units.join('\n');
  const chunks = [];
  let current = [],
    currentWords = 0;
  const flush = () => {
    if (current.length) chunks.push(current.join('\n'));
    current = [];
    currentWords = 0;
  };
  const add = (part) => {
    const count = part.split(/\s+/).filter(Boolean).length;
    if (currentWords + count > 250) flush();
    current.push(part);
    currentWords += count;
  };
  for (const unit of units) {
    if (unit.split(/\s+/).length <= 250) {
      add(unit);
      continue;
    }
    // Split oversized messages at sentence/paragraph boundaries first. A single
    // oversized sentence is the only case requiring a plain word-boundary split.
    for (const sentence of unit.split(/\n+|(?<=[.!?])\s+/u).filter(Boolean)) {
      const tokens = sentence.split(/\s+/).filter(Boolean);
      for (let i = 0; i < tokens.length; i += 250) add(tokens.slice(i, i + 250).join(' '));
    }
  }
  flush();
  return {
    text,
    chunks,
    selectedCount: selected.size,
    totalCount: usable.length,
  };
}

export function exportBrief(digest, aiSummary = '', completed = new Set()) {
  const brief = buildBrief(digest, completed);
  const labels = {
    action: 'Task',
    decision: 'Decision',
    deadline: 'Deadline',
    mention: 'For you',
    update: 'Update',
  };
  const lines = [
    '# CatchUp — What did I miss?',
    '',
    `Scope: messages ${digest.unreadFrom}–${digest.allMessages.length}. ${digest.messages.length} messages analyzed.`,
    '',
    ...(aiSummary
      ? ['## Experimental local AI overview (verify against source)', '', aiSummary, '']
      : []),
    '## Extractive brief',
    '',
    ...brief.overview.map((message) => `- ${message.excerpt} [#${message.id}]`),
    ...(brief.personal.length
      ? [
          '',
          '## For you',
          '',
          ...brief.personal.map((message) => `- ${message.excerpt} [#${message.id}]`),
        ]
      : []),
    ...(brief.nextSteps.length
      ? [
          '',
          '## Other follow-ups',
          '',
          ...brief.nextSteps.map((message) => `- ${message.excerpt} [#${message.id}]`),
        ]
      : []),
    '',
    '## Important messages',
    '',
  ];
  for (const item of digest.findings)
    lines.push(
      `### #${item.id} · ${item.priority.toUpperCase()} · ${item.tags.map((tag) => labels[tag]).join(', ')}`,
      `${item.sender}${item.date ? ' · ' + item.date : ''}${item.time ? ' · ' + item.time : ''}`,
      '',
      item.text,
      ...(item.owner
        ? [
            `Owner: ${item.owner.name}${item.owner.uncertain ? ' (not confirmed)' : ''}`,
            `Status: ${completed.has(item.id) ? 'Completed' : 'Open'}`,
          ]
        : []),
      ...(item.deadlines.length
        ? [
            '',
            `Stated time: ${item.deadlines.join('; ')}`,
            ...item.deadlineDetails.map(
              (d) =>
                `${d.label}: ${d.uncertain ? 'tentative ' : ''}${d.status}${d.display ? ' · ' + d.display : ''}`,
            ),
          ]
        : []),
      `Why: ${item.reasons.join('; ')}`,
      '',
    );
  lines.push(
    '---',
    'Processed on-device. Priority and task extraction use rules. Date interpretations use the selected current time and export date format; tentative interpretations are marked. AI summary, if included, is generated locally and may contain errors.',
  );
  return lines.join('\n');
}
