(() => {
  const local =
    ['localhost', '127.0.0.1'].includes(location.hostname) &&
    location.protocol === 'http:' &&
    location.port === '4173';
  const publicApp =
    location.origin === 'https://adiboi18.github.io' &&
    location.pathname.startsWith('/catchup-protocolx/');
  if (!local && !publicApp) return;
  document.documentElement.dataset.catchupWhatsApp = 'ready';
  document.addEventListener('click', (event) => {
    if (!event.isTrusted || !event.target.closest('#whatsapp-import-button')) return;
    const name = document.getElementById('whatsapp-chat-name')?.value.trim();
    const requestId = document.getElementById('whatsapp-import-button')?.dataset.requestId;
    if (!name || !requestId) return;
    chrome.runtime.sendMessage({ type: 'catchup-import', name }, (result) => {
      const error = chrome.runtime.lastError;
      window.postMessage(
        {
          type: 'catchup-import-result',
          requestId,
          result: error
            ? { ok: false, error: 'Helper disconnected. Reload this page and retry.' }
            : result,
        },
        location.origin,
      );
    });
  });
})();
