export function parseExportDate(value, format = 'day-first') {
  if (!value) return null;
  const parts = value.split(/[\/.-]/).map(Number);
  if (parts.length !== 3) return null;
  const [a, b, c] = parts;
  const iso = value.split(/[\/.-]/)[0].length === 4;
  const year = iso ? a : c < 100 ? 2000 + c : c;
  const month = iso ? b : format === 'month-first' ? a : b;
  const day = iso ? c : format === 'month-first' ? b : a;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}
function readTime(text) {
  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b|\b(\d{1,2}):(\d{2})\b/i);
  if (!m) return null;
  let h = Number(m[1] ?? m[4]),
    min = Number(m[2] ?? m[5] ?? 0);
  if (min > 59 || (m[3] ? h < 1 || h > 12 : h > 23)) return null;
  if (m[3]) h = (h % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0);
  return [h, min];
}
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function resolveDeadline(label, message, options = {}) {
  const now = new Date(options.asOf || Date.now());
  const format = options.dateFormat || 'day-first';
  const sourceDate = parseExportDate(message.date, format);
  const base = new Date(sourceDate || now);
  const sourceTime = readTime(message.time || '');
  if (sourceTime) base.setHours(...sourceTime, 0, 0);
  const time = readTime(label);
  const absolute = label.match(
    /\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/,
  );
  const relative = label.match(/\b(today|tomorrow|tonight)\b/i);
  const dayHints = [
    ...new Set(
      [...message.text.matchAll(/\b(today|tomorrow|tonight)\b/gi)].map((m) => m[1].toLowerCase()),
    ),
  ];
  const day = relative?.[1].toLowerCase() || (dayHints.length === 1 ? dayHints[0] : '');
  const weekday = weekdays.find((d) => new RegExp(`\\b${d}\\b`, 'i').test(label));
  const interval = label.match(/\bin\s+(\d+)\s+(minute|hour|day)s?\b/i);
  let due,
    uncertain = false,
    explanation = '';
  if (absolute) {
    const dateText =
      absolute[0].split(/[\/.-]/).length === 2
        ? `${absolute[0]}/${base.getFullYear()}`
        : absolute[0];
    due = parseExportDate(dateText, format);
    explanation = `Interpreted with ${format === 'day-first' ? 'day/month/year' : 'month/day/year'} date format.`;
  } else if (interval) {
    due = new Date(base);
    const unit = interval[2].toLowerCase(),
      n = Number(interval[1]);
    if (unit === 'day') due.setDate(due.getDate() + n);
    else due = new Date(due.getTime() + n * (unit === 'hour' ? 3600000 : 60000));
    uncertain = !sourceDate || !sourceTime;
    explanation = uncertain
      ? 'Incomplete message timestamp; interval uses selected current time where needed.'
      : 'Measured from the source message timestamp.';
  } else if (day) {
    due = new Date(base);
    due.setHours(0, 0, 0, 0);
    if (day === 'tomorrow') due.setDate(due.getDate() + 1);
    uncertain = !sourceDate;
    explanation = sourceDate
      ? 'Relative day measured from the source message date.'
      : 'No source date; interpreted relative to your selected current date.';
  } else if (weekday) {
    due = new Date(base);
    due.setHours(0, 0, 0, 0);
    let offset = (weekdays.indexOf(weekday) - due.getDay() + 7) % 7;
    if (/\bnext\b/i.test(label) && offset === 0) offset = 7;
    due.setDate(due.getDate() + offset);
    uncertain = !sourceDate || /\bnext\b/i.test(label);
    explanation =
      'Next occurrence of this weekday from the source date; confirm ambiguous “next” wording.';
  } else if (time) {
    due = new Date(base);
    due.setHours(0, 0, 0, 0);
    uncertain = true;
    explanation = 'Time stated without a day. Same-day interpretation is tentative.';
  }
  if (!due || Number.isNaN(due.getTime()) || Number.isNaN(now.getTime()))
    return {
      label,
      status: 'unknown',
      uncertain: true,
      explanation: 'Date could not be resolved. Check the source.',
    };
  if (time) due.setHours(...time, 0, 0);
  const precise = Boolean(time || (interval && interval[2].toLowerCase() !== 'day'));
  const status = precise
    ? due < now
      ? 'overdue'
      : due - now <= 86400000
        ? 'soon'
        : 'upcoming'
    : dayKey(due) < dayKey(now)
      ? 'overdue'
      : dayKey(due) === dayKey(now)
        ? 'today'
        : 'upcoming';
  const display =
    due.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
    (precise
      ? ' · ' + due.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : ' · time not stated');
  return {
    label,
    status,
    uncertain,
    dateISO: dayKey(due),
    timestamp: due.getTime(),
    display,
    explanation,
  };
}
