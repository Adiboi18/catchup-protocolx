import { SAMPLE_CHAT, parseChat, analyzeChat, buildAIInput, exportBrief } from './engine.js';
import { buildBrief, cleanBriefTakeaway } from './brief.js';
const $ = (id) => document.getElementById(id);
const labels = {
  action: 'Task',
  decision: 'Decision',
  deadline: 'Deadline',
  mention: 'For you',
  update: 'Update',
};
const symbols = { action: '↗', decision: '✓', deadline: '◷', mention: '@', update: '!' };
let digest = null;
let filter = 'all';
let aiSummary = '';
let worker;
let requestId = 0;
let activeAIInput;
let aiBusy = false;
let timer;
let completed = new Set();
let completionChat = '';
const STORAGE_KEY = 'catchup-saved-v1';
function chatKey(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${text.length}:${hash >>> 0}`;
}
function localDateTime(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function persist() {
  if (!$('remember-chat').checked) return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        chat: $('chat-input').value,
        name: $('your-name').value,
        from: $('unread-from').value,
        asOf: $('as-of').value,
        dateFormat: $('date-format').value,
        completed: [...completed],
        completionChat,
      }),
    );
    $('storage-status').textContent = 'Saved only in this browser.';
  } catch {
    $('storage-status').textContent = 'Could not save locally. Your current session still works.';
  }
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  clearTimeout(timer);
  timer = setTimeout(() => $('toast').classList.remove('visible'), 3000);
}
function updateCount() {
  $('input-count').textContent = `${parseChat($('chat-input').value).length} messages`;
}
function personalize() {
  const name = $('your-name').value.trim();
  $('greeting').textContent = name
    ? `A little clarity for you, ${name}.`
    : 'Your conversation, made clear.';
  $('results-title').textContent = name ? `${name}’s catch-up` : 'Your catch-up';
}
function invalidate() {
  personalize();
  aiBusy = false;
  requestId++;
  if (worker) {
    worker.terminate();
    worker = null;
  }
  digest = null;
  aiSummary = '';
  $('results').hidden = true;
  $('empty-state').hidden = false;
  $('export-button').disabled = true;
  $('ai-button').disabled = false;
  $('ai-progress').hidden = true;
}
function showSource(id) {
  const details = document.querySelector('.transcript');
  details.open = true;
  document
    .querySelectorAll('.source-message.highlight')
    .forEach((node) => node.classList.remove('highlight'));
  const source = $(`source-${id}`);
  source?.classList.add('highlight');
  source?.scrollIntoView({
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center',
  });
  if (source) {
    source.tabIndex = -1;
    source.focus({ preventScroll: true });
  }
}
function formatHighlights(text) {
  const safe = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return safe
    .replace(/\b(\d{1,2}(?:[:.]\d{2})?\s*(?:AM|PM|am|pm))\b/g, '<mark>$1</mark>')
    .replace(
      /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+\d{4})?)\b/gi,
      '<mark>$1</mark>',
    )
    .replace(
      /\b(closes(?:\s+at)?|due(?:\s+date)?|deadline|mandatory|urgent|approved|decided|today|tomorrow)\b/gi,
      '<strong>$1</strong>',
    );
}

function renderSummary() {
  const root = $('summary-text');
  root.replaceChildren();

  // 1. On-device AI Overview (clean, formatted card)
  if (aiSummary) {
    const aiBox = el('div', 'ai-overview-box');
    const header = el('div', 'ai-overview-header');
    header.append(
      el('span', 'ai-sparkle', '✦'),
      el('span', '', 'AI overview · verify with sources'),
    );
    aiBox.append(header);

    const paragraphs = aiSummary.split(/\n+/).filter(Boolean);
    for (const p of paragraphs) {
      const point = el('div', 'ai-overview-point');
      point.innerHTML = formatHighlights(p);
      aiBox.append(point);
    }
    root.append(aiBox);
  }

  if (!digest.summaryMessages.length) {
    root.append(el('p', '', 'There is no readable message content in this selection.'));
    return;
  }

  const brief = buildBrief(digest, completed);
  for (const [heading, entries] of [
    ['For you', brief.personal],
    ['What you need to know', brief.overview],
    ['Other follow-ups', brief.nextSteps],
  ]) {
    if (!entries.length) continue;
    const section = el(
      'section',
      heading === 'For you' ? 'brief-section personal-section' : 'brief-section',
    );
    section.append(el('h4', 'summary-section-title', heading));
    const container = el('div', 'brief-items-list');
    for (const message of entries) {
      const item = el('div', 'brief-item');

      const findingMatch = digest.findings.find((f) => f.id === message.id);
      const explicitUrgency = findingMatch?.reasons.includes('Urgency stated in message');
      const pastDeadline = findingMatch?.deadlineDetails.some(
        (d) => d.status === 'overdue' && !d.uncertain,
      );
      const tag = findingMatch
        ? explicitUrgency
          ? 'urgent'
          : pastDeadline
            ? 'deadline'
            : findingMatch.tags[0] || 'update'
        : 'update';
      const tagLabel = explicitUrgency
        ? 'Urgent'
        : pastDeadline
          ? 'Past deadline'
          : tag === 'decision'
            ? 'Decision'
            : tag === 'deadline'
              ? 'Deadline'
              : tag === 'action'
                ? 'Task'
                : 'Update';

      const badge = el('span', `brief-category-badge ${tag}`, tagLabel);

      const content = el('div', 'brief-content');
      content.innerHTML = formatHighlights(message.excerpt);

      const sourceBtn = el('button', 'brief-source-pill', `#${message.id} ↗`);
      sourceBtn.title = `Jump to original message #${message.id}`;
      sourceBtn.setAttribute('aria-label', `Read source message #${message.id}`);
      sourceBtn.type = 'button';
      sourceBtn.addEventListener('click', () => showSource(message.id));

      item.append(badge, content, sourceBtn);
      container.append(item);
    }
    section.append(container);
    root.append(section);
  }
  if (digest.name && !brief.personal.length)
    root.append(
      el(
        'p',
        'field-help',
        'No open messages mention your name in this selection. General instructions above may still apply to you.',
      ),
    );
}

function renderFindings() {
  const root = $('findings-list');
  root.replaceChildren();
  const items = digest.findings.filter(
    (item) =>
      (filter === 'all' ||
        (filter === 'urgent' && item.priority === 'high') ||
        item.tags.includes(filter)) &&
      (!$('only-open').checked || !completed.has(item.id)),
  );
  $('no-findings').hidden = items.length > 0;
  for (const item of items) {
    const primaryTag = item.priority === 'high' ? 'urgent' : item.tags[0] || 'update';
    const card = el(
      'article',
      `finding ${primaryTag} ${item.priority}${completed.has(item.id) ? ' completed' : ''}`,
    );
    const tabColor =
      primaryTag === 'urgent'
        ? 'tab-pink'
        : primaryTag === 'decision'
          ? 'tab-green'
          : primaryTag === 'action'
            ? 'tab-yellow'
            : primaryTag === 'deadline'
              ? 'tab-cyan'
              : primaryTag === 'mention'
                ? 'tab-purple'
                : 'tab-grey';
    const folderTab = el('div', `folder-tab ${tabColor}`);
    card.append(folderTab);

    const symbol = el(
      'div',
      'finding-symbol',
      item.priority === 'high' ? '!' : symbols[item.tags[0]] || '✓',
    );
    symbol.setAttribute('aria-hidden', 'true');
    const body = el('div', 'finding-body');
    const top = el('div', 'finding-top');
    const tags = el('div', 'finding-tags');
    item.tags.forEach((tag) => tags.append(el('span', `tag ${tag}`, labels[tag])));
    const priority = el(
      'span',
      `priority ${item.priority}`,
      item.priority === 'high'
        ? 'Needs attention'
        : item.priority === 'medium'
          ? 'Follow up'
          : 'Good to know',
    );
    priority.title = item.reasons.join(' · ') || 'Decision or important update';
    top.append(tags, priority);

    // High-impact bold Takeaway
    const takeaway = cleanBriefTakeaway(item.text);
    const takeawayEl = el('div', 'finding-takeaway');
    takeawayEl.innerHTML = formatHighlights(takeaway);

    body.append(top, takeawayEl);
    if (item.owner)
      body.append(
        el(
          'div',
          'owner-line',
          `Owner: ${item.owner.name}${item.owner.uncertain ? ' · not confirmed' : ''}`,
        ),
      );
    if (item.deadlines.length) {
      const deadlines = el('div', 'deadline-line');
      const states = {
        overdue: 'Overdue',
        soon: 'Due within 24h',
        today: 'Due today',
        upcoming: 'Upcoming',
        unknown: 'Check date',
      };
      for (const d of item.deadlineDetails) {
        const line = el(
          'span',
          `deadline-detail ${d.status}`,
          `◷ ${d.label} → ${d.uncertain ? 'Tentative · ' : ''}${states[d.status]}${d.display ? ' · ' + d.display : ''}`,
        );
        line.title = d.explanation;
        deadlines.append(line);
      }
      body.append(deadlines);
    }
    if (item.reasons.length)
      body.append(el('div', 'priority-reason', `Why: ${item.reasons.join(' · ')}`));
    const meta = el('div', 'finding-meta');
    meta.append(el('span', '', [item.sender, item.time || item.date].filter(Boolean).join(' · ')));
    const button = el('button', 'source-button', `Source #${item.id} ↗`);
    button.addEventListener('click', () => showSource(item.id));
    meta.append(button);
    body.append(meta);
    if (item.tags.includes('action')) {
      const label = el('label', 'complete-task');
      const checkbox = el('input');
      checkbox.type = 'checkbox';
      checkbox.checked = completed.has(item.id);
      checkbox.setAttribute('aria-label', `Mark task #${item.id} complete`);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) completed.add(item.id);
        else completed.delete(item.id);
        persist();
        renderStats();
        renderFindings();
        renderSummary();
      });
      label.append(checkbox, el('span', '', checkbox.checked ? 'Completed' : 'Mark completed'));
      body.append(label);
    }
    card.append(symbol, body);
    root.append(card);
  }
}
function renderStats() {
  const done = digest.findings.filter(
    (item) => item.tags.includes('action') && completed.has(item.id),
  ).length;
  $('completed-count').textContent = `${done} completed`;
  $('stats').replaceChildren();
  const attention = digest.findings.filter(
    (item) => item.priority === 'high' && !completed.has(item.id),
  ).length;
  for (const [value, label, urgent] of [
    [attention, 'need attention', true],
    [digest.stats.tasks - done, 'open tasks', false],
    [digest.stats.decisions, 'decisions', false],
  ]) {
    const stat = el('div', `stat${urgent ? ' urgent' : ''}`);
    stat.append(el('strong', '', String(value)), el('span', '', label));
    $('stats').append(stat);
  }
}
function renderSources() {
  const root = $('source-list');
  root.replaceChildren();
  for (const message of digest.allMessages) {
    const row = el('li', `source-message${message.id < digest.unreadFrom ? ' read' : ''}`);
    row.id = `source-${message.id}`;
    row.append(
      el(
        'span',
        'source-label',
        [
          `#${message.id}`,
          message.sender,
          message.date,
          message.time,
          message.id < digest.unreadFrom ? 'Already read' : '',
        ]
          .filter(Boolean)
          .join(' · '),
      ),
      el('span', '', message.text),
    );
    root.append(row);
  }
  $('source-count').textContent = `(${digest.allMessages.length} messages)`;
}
function analyze() {
  $('input-error').hidden = true;
  if (!$('chat-input').value.trim()) {
    $('input-error').textContent = 'Paste a conversation or try the sample chat first.';
    $('input-error').hidden = false;
    $('chat-input').focus();
    return;
  }
  const from = Number($('unread-from').value);
  const count = parseChat($('chat-input').value).length;
  if (!Number.isInteger(from) || from < 1 || from > count) {
    $('input-error').textContent = `Choose a starting message between 1 and ${count}.`;
    $('input-error').hidden = false;
    $('unread-from').focus();
    return;
  }
  if (worker && $('ai-button').disabled) {
    worker.terminate();
    worker = null;
  }
  requestId++;
  aiSummary = '';
  filter = 'all';
  const key = chatKey($('chat-input').value);
  if (completionChat !== key) {
    completed = new Set();
    completionChat = key;
  }
  if (!$('as-of').value || Number.isNaN(new Date($('as-of').value).getTime())) {
    $('input-error').textContent = 'Choose a valid current date and time in settings.';
    $('input-error').hidden = false;
    return;
  }
  digest = analyzeChat($('chat-input').value, $('your-name').value, from, {
    asOf: $('as-of').value,
    dateFormat: $('date-format').value,
  });
  $('empty-state').hidden = true;
  personalize();
  $('results').hidden = false;
  $('export-button').disabled = false;
  $('digest-info').textContent =
    `${digest.messages.length} messages · ~${digest.readMinutes} min of reading`;
  $('processing-time').textContent = 'On your device';
  renderStats();
  $('summary-mode').textContent = 'Source-backed';
  $('ai-status').textContent = 'Runs locally. First use downloads the model.';
  $('ai-button').textContent = 'Try local AI';
  $('ai-button').disabled = false;
  $('ai-progress').hidden = true;
  document.querySelectorAll('.filter').forEach((button) => {
    const selected = button.dataset.filter === 'all';
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  renderSummary();
  renderFindings();
  renderSources();
  persist();
  if (innerWidth <= 700) $('results-title').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function startAI() {
  if (!digest) return;
  activeAIInput = buildAIInput(digest);
  if (!activeAIInput.text.trim()) {
    toast('No readable messages to summarize.');
    return;
  }
  const id = ++requestId;
  aiBusy = true;
  $('ai-button').disabled = true;
  $('ai-button').textContent = 'Working…';
  $('ai-status').textContent =
    'Preparing the local model. The first download may take a few minutes.';
  $('ai-progress').hidden = false;
  $('ai-progress').value = 0;
  if (!worker) {
    worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') {
        if (!aiBusy) return;
        $('ai-progress').value = data.progress;
        if (data.total)
          $('ai-status').textContent =
            `Downloading model files: ${(data.loaded / 1048576).toFixed(0)} / ${(data.total / 1048576).toFixed(0)} MB. Chat stays here.`;
        else if (data.status === 'ready')
          $('ai-status').textContent = 'Model ready. Creating your summary on this device…';
        return;
      }
      if (data.requestId !== requestId || !digest) return;
      if (data.type === 'running') {
        $('ai-status').textContent =
          `Summarizing on your device${data.sections > 1 ? ` · section ${data.section} of ${data.sections}` : ''}. Larger chats take longer.`;
        $('ai-progress').removeAttribute('value');
        return;
      }
      if (data.type === 'result') {
        aiBusy = false;
        aiSummary = data.text;
        $('summary-mode').textContent = 'Local AI · verify';
        $('ai-status').textContent =
          `Processed ${activeAIInput.selectedCount} of ${activeAIInput.totalCount} messages with FLAN-T5 Small${activeAIInput.selectedCount < activeAIInput.totalCount ? ' · long-chat limit: important messages prioritized' : ''}. The model may miss details; source-backed key facts remain above.`;
        $('ai-button').disabled = false;
        $('ai-button').textContent = 'Summarize again';
        $('ai-progress').hidden = true;
        renderSummary();
        toast('Local AI overview ready. Please verify the source facts.');
      }
      if (data.type === 'quality-failure') {
        aiBusy = false;
        aiSummary = '';
        $('summary-mode').textContent = 'Source-backed';
        $('ai-status').textContent =
          'The model did not produce a usable overview. Your source-backed brief is ready above.';
        $('ai-button').disabled = false;
        $('ai-button').textContent = 'Retry local AI';
        $('ai-progress').hidden = true;
        renderSummary();
        toast('Kept your source-backed brief. Unusable AI output was hidden.');
      }
      if (data.type === 'error') aiFailed(data.message);
    };
    worker.onerror = (event) => {
      aiFailed(event.message);
      worker?.terminate();
      worker = null;
    };
  }
  worker.postMessage({ text: activeAIInput.text, chunks: activeAIInput.chunks, requestId: id });
}
function aiFailed(message) {
  aiBusy = false;
  worker?.terminate();
  worker = null;
  $('ai-status').textContent =
    'Local AI could not start. Your extractive brief and important messages still work. Check your connection and try again.';
  $('ai-button').disabled = false;
  $('ai-button').textContent = 'Retry local AI';
  $('ai-progress').hidden = true;
  console.warn('Local AI could not run:', message);
}
$('analyze-button').addEventListener('click', analyze);
$('chat-input').addEventListener('input', () => {
  invalidate();
  updateCount();
  completed = new Set();
  completionChat = '';
  persist();
});
$('your-name').addEventListener('input', invalidate);
$('clear-button').addEventListener('click', () => {
  $('chat-input').value = '';
  $('unread-from').value = '1';
  completed = new Set();
  completionChat = '';
  invalidate();
  updateCount();
  persist();
  $('chat-input').focus();
});
$('unread-from').addEventListener('input', invalidate);
$('demo-button').addEventListener('click', () => {
  invalidate();
  if (!$('your-name').value.trim()) $('your-name').value = 'Adyan';
  $('chat-input').value = SAMPLE_CHAT.replaceAll('@Adyan', `@${$('your-name').value.trim()}`);
  $('unread-from').value = '1';
  updateCount();
  personalize();
  analyze();
  toast('Sample chat loaded. Try “For you” to see your tasks.');
});
$('upload-button').addEventListener('click', () => $('chat-file').click());
$('chat-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 800000) {
    $('input-error').textContent = 'Choose a text file smaller than 800 KB for this demo.';
    $('input-error').hidden = false;
    event.target.value = '';
    return;
  }
  try {
    const text = await file.text();
    if (text.length > 200000)
      throw new Error('This file is too long. Use up to 200,000 characters.');
    invalidate();
    $('chat-input').value = text;
    $('unread-from').value = '1';
    updateCount();
    $('input-error').hidden = true;
    toast('Chat file read locally. Select Catch me up.');
  } catch (error) {
    $('input-error').textContent = error.message || 'Could not read this text file.';
    $('input-error').hidden = false;
  }
  event.target.value = '';
});
function syncFilterUI(newFilter) {
  filter = newFilter;
  document.querySelectorAll('.filter').forEach((item) => {
    const selected = item.dataset.filter === filter;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
}
document.querySelectorAll('.filter').forEach((button) =>
  button.addEventListener('click', () => {
    if (!digest) return;
    syncFilterUI(button.dataset.filter);
    renderFindings();
  }),
);
$('ai-button').addEventListener('click', startAI);
$('export-button').addEventListener('click', () => {
  if (!digest) return;
  const url = URL.createObjectURL(
    new Blob([exportBrief(digest, aiSummary, completed)], { type: 'text/markdown;charset=utf-8' }),
  );
  const link = el('a');
  link.href = url;
  link.download = 'catchup-brief.md';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Your brief was saved to this device.');
});
$('privacy-button').addEventListener('click', () => $('privacy-dialog').showModal());
$('close-privacy').addEventListener('click', () => $('privacy-dialog').close());
$('privacy-dialog').addEventListener('click', (event) => {
  if (event.target === $('privacy-dialog')) {
    const rect = event.target.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      event.target.close();
  }
});
$('as-of').value = localDateTime();
for (const id of ['as-of', 'date-format'])
  $(id).addEventListener('change', () => {
    invalidate();
    persist();
  });
for (const id of ['your-name', 'unread-from']) $(id).addEventListener('change', persist);
$('only-open').addEventListener('change', () => {
  if (digest) renderFindings();
});
$('remember-chat').addEventListener('change', () => {
  if ($('remember-chat').checked) persist();
  else {
    try {
      localStorage.removeItem(STORAGE_KEY);
      $('storage-status').textContent = 'Saved copy removed. Current chat stays in this tab.';
    } catch {
      $('storage-status').textContent = 'Could not clear browser storage.';
    }
  }
});
$('forget-chat').addEventListener('click', () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    $('remember-chat').checked = false;
    $('storage-status').textContent = 'Saved chat removed from this browser.';
    toast('Saved chat removed.');
  } catch {
    toast('Could not clear browser storage.');
  }
});
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved && typeof saved.chat === 'string' && saved.chat.length <= 200000) {
    $('chat-input').value = saved.chat;
    $('your-name').value = String(saved.name || '').slice(0, 80);
    $('unread-from').value = String(Number(saved.from) || 1);
    if (saved.asOf && !Number.isNaN(new Date(saved.asOf).getTime())) $('as-of').value = saved.asOf;
    if (['day-first', 'month-first'].includes(saved.dateFormat))
      $('date-format').value = saved.dateFormat;
    completed = new Set(
      Array.isArray(saved.completed) ? saved.completed.filter(Number.isInteger) : [],
    );
    completionChat = String(saved.completionChat || '');
    $('remember-chat').checked = true;
    $('storage-status').textContent = 'Restored your saved chat from this browser.';
    if (saved.chat.trim()) analyze();
  }
} catch {
  $('storage-status').textContent = 'Saved data could not be restored. Paste a chat to continue.';
}
if (document.modelContext?.registerTool) {
  // This tool analyzes only the public demonstration input; private chat content is not exposed.
  Promise.resolve(
    document.modelContext.registerTool({
      name: 'load_catchup_demo',
      title: 'Try the CatchUp sample',
      description:
        'Replace the current visible conversation with fictional sample data and display its catch-up dashboard. Does not send chat data anywhere.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (
          !input ||
          typeof input !== 'object' ||
          Array.isArray(input) ||
          Object.keys(input).length
        )
          throw new Error('Expected an empty object.');
        $('demo-button').click();
        return {
          messages: digest.messages.length,
          tasks: digest.stats.tasks,
          decisions: digest.stats.decisions,
        };
      },
    }),
  ).catch(() => {});
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
updateCount();
personalize();
