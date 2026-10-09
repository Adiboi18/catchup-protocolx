// Only a click in our app can initiate a read. No timer, cookies, tokens or network uploads.
function allowedApp(raw) {
  try {
    const url = new URL(raw);
    return (
      (['127.0.0.1', 'localhost'].includes(url.hostname) &&
        url.protocol === 'http:' &&
        url.port === '4173') ||
      (url.origin === 'https://adiboi18.github.io' &&
        url.pathname.startsWith('/catchup-protocolx/'))
    );
  } catch {
    return false;
  }
}
chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (
    !allowedApp(sender.url) ||
    request?.type !== 'catchup-import' ||
    typeof request.name !== 'string' ||
    !request.name.trim() ||
    request.name.length > 80
  )
    return;
  (async () => {
    const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    if (tabs.length !== 1)
      throw new Error(
        tabs.length
          ? 'Keep one WhatsApp Web tab open, then retry.'
          : 'Open WhatsApp Web in Brave and sign in, then retry.',
      );
    const result = await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'catchup-read',
      name: request.name.trim(),
    });
    if (!result?.ok)
      throw new Error(result?.error || 'Could not read this chat. Reload WhatsApp Web and retry.');
    if (typeof result.text !== 'string' || result.text.length > 200000)
      throw new Error('Import is too large for this demo.');
    respond(result);
  })().catch((error) => respond({ ok: false, error: error.message }));
  return true;
});
