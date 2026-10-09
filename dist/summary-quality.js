// These checks catch obvious model failures. They do not verify factual accuracy.
const STOP_WORDS = new Set(
  `a an and are as at be been being by for from had has have he her hers him his how
  i if in into is it its me my of on or our ours she that the their them there these
  they this those to us was we were what when where which who why with you your
  about also all any can could do does did get getting here just more most much
  need needs now one only other same some such than then very want would
  conversation conversations message messages text summary summarize summarise
  following information important importance details detail list overview
  clear concise brief project know`.split(/\s+/),
);

const NUMBER_WORDS = new Map(
  [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
    'twenty',
  ]
    .map((word, index) => [word, String(index)])
    .concat([
      ['first', '1'],
      ['second', '2'],
      ['third', '3'],
      ['fourth', '4'],
      ['fifth', '5'],
      ['sixth', '6'],
      ['seventh', '7'],
      ['eighth', '8'],
      ['ninth', '9'],
      ['tenth', '10'],
    ]),
);

const DEDUP_KEEP = new Set(
  `no not never only must should may might could can will would cancelled canceled
  tentative possibly now then when before after next last today tomorrow yesterday
  all any some one`.split(/\s+/),
);

function words(text) {
  return (
    text
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu) || []
  );
}

function contentWords(text) {
  return words(text).filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

function numbers(text) {
  const normalized = text.replace(/\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/g, (value) =>
    value.replaceAll(',', ''),
  );
  const result = new Set();
  const rawMatches = normalized.match(/\d+(?:\.\d+)?/g) || [];
  for (const value of rawMatches) {
    result.add(String(Number(value)));
    if (value.includes('.')) {
      const parts = value.split('.');
      parts.forEach((p) => {
        if (p) result.add(String(Number(p)));
      });
    }
    const num = Number(value);
    if (num >= 2000 && num <= 2099) {
      result.add(String(num - 2000));
    }
  }
  for (const word of words(text)) {
    if (NUMBER_WORDS.has(word)) {
      const val = NUMBER_WORDS.get(word);
      result.add(val);
      const num = Number(val);
      if (num >= 2000 && num <= 2099) {
        result.add(String(num - 2000));
      }
    }
  }
  return result;
}

function repeatedSequence(tokens) {
  for (let size = 1; size <= 6; size++) {
    for (let start = 0; start + size * 3 <= tokens.length; start++) {
      const first = tokens.slice(start, start + size).join(' ');
      if (
        first === tokens.slice(start + size, start + size * 2).join(' ') &&
        first === tokens.slice(start + size * 2, start + size * 3).join(' ')
      )
        return true;
    }
  }
  return false;
}

export function assessSummary(output, source) {
  const text = typeof output === 'string' ? output.trim() : '';
  const reject = (reason) => ({ ok: false, text, reason });
  if (!text) return reject('The model did not produce an overview.');

  const tokens = words(text);
  if (tokens.length < 4) return reject('The overview contains too little useful information.');
  if (
    repeatedSequence(tokens) ||
    /([*#=_~])(?:\s*\1){4,}/u.test(text) ||
    (text.match(/\bMessage\s*:/gi) || []).length >= 3
  )
    return reject('The model repeated labels, words or formatting instead of summarizing.');

  const visible = [...text.replace(/\s/gu, '')];
  const lettersAndNumbers = (text.match(/[\p{L}\p{N}]/gu) || []).length;
  if (lettersAndNumbers / visible.length < 0.55) {
    return reject('The overview contains mostly formatting or punctuation.');
  }
  if (
    /^(?:please\s+)?summari[sz]e\s+(?:this|the|following|these)\b/i.test(text) ||
    /^(?:please\s+)?write\s+(?:a|an)\s+(?:short|brief|concise|one|two)[\s-]*(?:sentence[\s-]*)?summary\b/i.test(
      text,
    ) ||
    /\b(?:as an ai|language model|i cannot summarize|i can't summarize)\b/i.test(text)
  )
    return reject('The model echoed instructions instead of giving an overview.');

  const sourceText = typeof source === 'string' ? source : '';
  const sourceNumbers = numbers(sourceText);
  if ([...numbers(text)].some((value) => !sourceNumbers.has(value))) {
    return reject('The overview introduced a number that was absent from the conversation.');
  }

  const sourceContent = new Set(contentWords(sourceText));
  const summaryContent = new Set(contentWords(text));
  const shared = [...summaryContent].filter((word) => sourceContent.has(word)).length;
  if (
    summaryContent.size < 2 ||
    shared < Math.min(2, sourceContent.size) ||
    shared / summaryContent.size < 0.25
  ) {
    return reject('The overview is too generic or insufficiently connected to the conversation.');
  }

  return { ok: true, text, reason: '' };
}

function sentenceKey(sentence) {
  // Preserve content order, quantities, negation and modal verbs. Only superficial
  // differences are removed; two similar-looking facts can still mean different things.
  return words(sentence)
    .filter((word) => !STOP_WORDS.has(word) || DEDUP_KEEP.has(word))
    .join(' ');
}

export function combineSummaries(outputs, source) {
  if (!Array.isArray(outputs) || !outputs.length) {
    return { ok: false, text: '', reason: 'The model did not produce an overview.' };
  }
  const checks = outputs.map((output) => assessSummary(output, source));
  const failed = checks.find((check) => !check.ok);
  if (failed) return { ok: false, text: '', reason: failed.reason };

  const seen = new Set();
  const unique = [];
  for (const check of checks) {
    const sentences = check.text.split(/(?<=[.!?])\s+(?=[\p{Lu}\p{N}])|\n+/u);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      const key = sentenceKey(trimmed);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(trimmed);
    }
  }
  const combined = assessSummary(unique.join(' '), source);
  return combined.ok ? combined : { ...combined, text: '' };
}
