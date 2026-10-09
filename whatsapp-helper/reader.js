// Read ordinary, rendered message text only. Do not access WhatsApp internals or login data.
(() => {
  let busy = false;
  const normalize = (text) =>
    String(text || '')
      .normalize('NFKC')
      .trim();
  function currentName() {
    const header = document.querySelector('#main header');
    return header
      ? [...header.querySelectorAll('[title], span[dir="auto"]')]
          .map((node) => normalize(node.getAttribute('title') || node.textContent))
          .filter(Boolean)
      : [];
  }
  async function readChat(name) {
    if (busy) throw new Error('Another import is running. Wait and retry.');
    busy = true;
    try {
      const wanted = normalize(name);
      if (!currentName().includes(wanted)) {
        const sidebar = document.querySelector('#pane-side');
        const matches = sidebar
          ? [...sidebar.querySelectorAll('[title]')].filter(
              (node) => normalize(node.getAttribute('title')) === wanted,
            )
          : [];
        const rows = [
          ...new Set(
            matches.map(
              (node) => node.closest('[role="row"]') || node.closest('[role="listitem"]') || node,
            ),
          ),
        ];
        if (rows.length !== 1)
          throw new Error(
            rows.length
              ? 'Multiple chats match. Open the correct chat manually and retry.'
              : 'Find and open this exact chat in WhatsApp Web, then retry.',
          );
        rows[0].click();
      }
      let ready = false;
      for (let i = 0; i < 30; i++) {
        if (
          currentName().includes(wanted) &&
          document.querySelector('#main [data-pre-plain-text]')
        ) {
          ready = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!ready)
        throw new Error(
          'Could not confirm the selected chat or read messages. Open the chat, wait for messages to load, and retry.',
        );
      const main = document.querySelector('#main');
      const seen = new Set(),
        lines = [];
      let size = 0;
      for (const node of main.querySelectorAll('[data-pre-plain-text]')) {
        const prefix = node.getAttribute('data-pre-plain-text') || '';
        const textNodes = [...node.querySelectorAll('.selectable-text')].filter(textNode => !textNode.parentElement.closest('.selectable-text') && !textNode.closest('[aria-label="Quoted message"]'));
        const text = textNodes
          .map((n) => n.innerText)
          .join('\n')
          .trim();
        if (!text || !prefix) continue;
        const row = node.closest('[data-id]');
        const identity = row?.getAttribute('data-id') || `${prefix}\n${text}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        const line = `${prefix.trim()} ${text}`;
        if (size + line.length + 1 > 200000) break;
        lines.push(line);
        size += line.length + 1;
      }
      if (!lines.length)
        throw new Error('No supported text messages are loaded. Use official .txt export instead.');
      return {
        ok: true,
        name: wanted,
        text: lines.join('\n'),
        count: lines.length,
        partial: true,
        capturedAt: new Date().toISOString(),
      };
    } finally {
      busy = false;
    }
  }
  chrome.runtime.onMessage.addListener((request, sender, respond) => {
    if (
      sender.id !== chrome.runtime.id ||
      request?.type !== 'catchup-read' ||
      typeof request.name !== 'string' ||
      request.name.length > 80
    )
      return;
    readChat(request.name)
      .then(respond)
      .catch((error) => respond({ ok: false, error: error.message }));
    return true;
  });
})();
