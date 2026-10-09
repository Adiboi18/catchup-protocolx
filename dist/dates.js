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
const timePattern =
  /\b(\d{1,2})(?:[:.](\d{2})(?::\d{2})?)?\s*(AM|PM)\b|\b(\d{1,2}):(\d{2})(?::\d{2})?\b/i;
function readTime(text) {
  const m = text.match(timePattern);
  if (!m) return null;
  let h = Number(m[1] ?? m[4]),
    min = Number(m[2] ?? m[5] ?? 0);
  if (min > 59 || (m[3] ? h < 1 || h > 12 : h > 23)) return null;
  if (m[3]) h = (h % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0);
  return [h, min];
}
const months = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const monthNames =
  'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec';
const namedDatePattern = new RegExp(
  `\\b(?:(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})|(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?)(?:,?\\s+(\\d{4}))?\\b`,
  'i',
);
const dateRangePattern = new RegExp(
  `\\b\\d{1,2}(?:st|nd|rd|th)?\\s*(?:[–—-]|to)\\s*\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthNames})\\b|` +
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthNames})(?:,?\\s+\\d{4})?\\s*(?:[–—-]|to)\\s*\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${monthNames})\\b|` +
    `\\b(?:${monthNames})\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*(?:[–—-]|to)\\s*\\d{1,2}\\b|` +
    '\\b\\d{4}-\\d{1,2}-\\d{1,2}\\s*(?:[–—-]|to)\\s*\\d{4}-\\d{1,2}-\\d{1,2}\\b|' +
    '\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\s*(?:[–—-]|to)\\s*\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b',
  'i',
);
function readNamedDate(match, fallbackYear) {
  const day = Number(match[1] || match[4]);
  const monthName = (match[2] || match[3]).toLowerCase();
  const month = months.findIndex((name) => name.startsWith(monthName.slice(0, 3)));
  const year = Number(match[5] || fallbackYear);
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}
const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function resolveDeadline(label, message, options = {}) {
  if (dateRangePattern.test(label))
    return {
      label,
      status: 'unknown',
      uncertain: true,
      explanation: 'A date range is stated. Check the source for the actual submission deadline.',
    };
  const now = new Date(options.asOf || Date.now());
  const format = options.dateFormat || 'day-first';
  const sourceDate = parseExportDate(message.date, format);
  const base = new Date(sourceDate || now);
  const sourceTime = readTime(message.time || '');
  if (sourceTime) base.setHours(...sourceTime, 0, 0);
  const time = readTime(label);
  const namedDate = label.match(namedDatePattern);
  // A clock such as 8.30 AM is not a short calendar date such as 8/10.
  const withoutTime = label.replace(timePattern, ' ');
  const absolute = withoutTime.match(
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
  if (namedDate) {
    due = readNamedDate(namedDate, base.getFullYear());
    uncertain = !namedDate[5];
    explanation = namedDate[5]
      ? 'Interpreted the month name and year stated in the message.'
      : 'Year was not stated; the source message year is tentative.';
  } else if (absolute) {
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
  } else if (/\bnext\s+(?:class|session|meeting)\b/i.test(label) && !weekday) {
    return {
      label,
      status: 'unknown',
      uncertain: true,
      explanation:
        'The next class, session or meeting has no stated calendar date. Confirm the schedule.',
    };
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
