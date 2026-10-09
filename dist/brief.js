// Abridged quotations. Every item retains its source message; no facts are generated here.
function cleanText(raw) {
  return String(raw)
    .replace(/\[Forwarded(?: many times)?\]\s*/gi, '')
    .replace(/\[([^\]\n]+)\]\(https?:\/\/[^\s)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '[link in source]')
    .replace(/[*_`~]+/g, '')
    .replace(/^[ \t]*#+[ \t]*/gm, '')
    .replace(/<(?:image|media|sticker|video) omitted>|<message_history_notice message>/gi, '')
    .replace(/^(?:dear|respected)\s+(?:students|professors|team|all)[,:]?\s*/i, '')
    .replace(/\n\s*(?:warm\s+regards|regards|sincerely|best\s+wishes)[,.!\s]*\n[\s\S]*$/i, '')
    .trim();
}
function pieces(raw) {
  const seen = new Set();
  return cleanText(raw)
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z@0-9])/)
    .map((part) => part.replace(/^[\s•*]+/, '').trim())
    .filter((part) => {
      const key = part.toLowerCase().replace(/\s+/g, ' ');
      if (
        !part ||
        seen.has(key) ||
        /^(?:dear (?:students|professors|team|all)|regards|warm regards|thanks|\[link in source\])[,.:]?$/i.test(
          part,
        )
      )
        return false;
      seen.add(key);
      return true;
    });
}
function score(part) {
  return (
    (/deadline|closes|due|on or before|submit|\b(?:by|before)\s+(?:\d|today|tomorrow|tonight|noon|midnight|monday|tuesday|wednesday|thursday|friday|eod)\b/i.test(
      part,
    )
      ? 5
      : 0) +
    (/decided|agreed|approved|must|mandatory|required|\bteam\b.*(?:\d|one)/i.test(part) ? 4 : 0) +
    (/urgent|immediately|blocked|please|requested|permission/i.test(part) ? 3 : 0) +
    (/registration|\bteam\b|\bclass\b|schedule/i.test(part) ? 1 : 0) +
    (/closes|deadline|on or before/i.test(part) ? 5 : 0) +
    (/\bteam\b.*\d+\s*(?:to|[-–])\s*\d+/i.test(part) ? 5 : 0)
  );
}
function clip(part, limit) {
  if (part.length <= limit) return part;
  const boundary = part.lastIndexOf(' ', limit - 1);
  return part.slice(0, boundary > limit * 0.6 ? boundary : limit - 1).trimEnd() + '…';
}
export function evidenceExcerpt(raw) {
  const text = cleanText(raw);
  if (text.length <= 300) return text.replace(/\s+/g, ' ');
  const parts = pieces(raw).map((part, index) => ({ part, index, score: score(part) }));
  const chosen = [
    parts[0],
    ...parts
      .slice(1)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 3),
  ]
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
  return clip(chosen.map(({ part }) => clip(part, 180)).join(' … '), 618);
}
export function cleanBriefTakeaway(raw) {
  const text = cleanText(raw).replace(/\s+/g, ' ');
  if (text.length <= 310) return text;
  const parts = pieces(raw).map((part, index) => ({ part, index, score: score(part) }));
  if (parts.length === 1) return clip(text, 310);
  const chosen = [
    parts[0],
    ...parts
      .slice(1)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 2),
  ]
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
  return clip(chosen.map(({ part }) => clip(part, 150)).join(' … '), 420);
}
export function buildBrief(digest, completed = new Set()) {
  const used = new Set();
  const unique = (items, max) => {
    const result = [];
    for (const item of items) {
      const text = cleanBriefTakeaway(item.text);
      const key = text.toLowerCase();
      if (!text || used.has(key)) continue;
      used.add(key);
      result.push({ ...item, excerpt: text });
      if (result.length === max) break;
    }
    return result;
  };
  const personal = unique(
    digest.findings.filter((item) => item.tags.includes('mention') && !completed.has(item.id)),
    3,
  );
  const personalIds = new Set(personal.map((item) => item.id));
  const overview = unique(
    digest.summaryMessages.filter((item) => !personalIds.has(item.id) && !completed.has(item.id)),
    6,
  );
  const nextSteps = unique(
    digest.findings
      .filter(
        (item) =>
          item.tags.includes('action') && !completed.has(item.id) && !personalIds.has(item.id),
      )
      .sort((a, b) => b.id - a.id),
    2,
  );
  return { overview, personal, nextSteps };
}
