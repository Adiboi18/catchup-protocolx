import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../dist/engine.js';
import * as brief from '../dist/brief.js';

// Execute the actual controller and processing modules against a small DOM adapter.
// This verifies event wiring and state, not browser rendering or download completion.
const html = fs.readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const script = fs
  .readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('import.meta.url', "'http://localhost/app.js'");
function app({ mobile = false, saved = null } = {}) {
  const nodes = new Map();
  const settings = { open: false };
  const transcript = { open: false };
  const downloads = [];
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.value = '';
      this.children = [];
      this.events = {};
      this.hidden = false;
      this.checked = false;
      this.disabled = false;
      this.classList = { add() {}, remove() {}, toggle() {} };
    }
    set id(id) {
      this._id = id;
      nodes.set(id, this);
    }
    get id() {
      return this._id;
    }
    append(...children) {
      this.children.push(...children);
    }
    replaceChildren(...children) {
      this.children = children;
    }
    setAttribute(key, value) {
      this[key] = value;
    }
    removeAttribute(key) {
      delete this[key];
    }
    addEventListener(event, callback) {
      this.events[event] = callback;
    }
    click() {
      if (this.tag === 'a')
        downloads.push({ connected: body.children.includes(this), name: this.download });
      return this.events.click?.({ target: this });
    }
    focus() {
      this.focused = true;
    }
    scrollIntoView(options) {
      this.scroll = options;
    }
    closest() {
      return settings;
    }
    remove() {
      body.children = body.children.filter((child) => child !== this);
    }
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
    }
  }
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    const node = new Element();
    node.id = id;
  }
  nodes.get('unread-from').value = '1';
  nodes.get('date-format').value = 'day-first';
  const body = new Element('body');
  const document = {
    body,
    getElementById(id) {
      assert.ok(nodes.has(id), `Missing HTML control: ${id}`);
      return nodes.get(id);
    },
    createElement(tag) {
      return new Element(tag);
    },
    querySelector(selector) {
      assert.equal(selector, '.transcript');
      return transcript;
    },
    querySelectorAll() {
      return [];
    },
  };
  const context = vm.createContext({
    ...engine,
    ...brief,
    document,
    navigator: {},
    localStorage: {
      getItem() {
        return saved ? JSON.stringify(saved) : null;
      },
      setItem() {},
      removeItem() {},
    },
    URL: class extends URL {
      static createObjectURL() {
        return 'blob:brief';
      }
      static revokeObjectURL() {}
    },
    Blob,
    console: { warn() {} },
    setTimeout() {},
    clearTimeout() {},
    matchMedia() {
      return { matches: true };
    },
    innerWidth: mobile ? 375 : 1200,
    Worker: class {
      constructor() {
        throw new Error('Worker unavailable');
      }
    },
  });
  vm.runInContext(script, context);
  return { nodes, settings, transcript, body, downloads, context };
}
test('empty input focuses the conversation and shows a useful error', () => {
  const { nodes } = app();
  nodes.get('analyze-button').click();
  assert.equal(nodes.get('input-error').hidden, false);
  assert.equal(nodes.get('chat-input').focused, true);
});
test('invalid unread range reveals the hidden preference before focusing it', () => {
  const { nodes, settings } = app();
  nodes.get('chat-input').value = 'Maya: Please bring your ID.';
  nodes.get('unread-from').value = '99';
  nodes.get('analyze-button').click();
  assert.equal(settings.open, true);
  assert.equal(nodes.get('unread-from').focused, true);
});
test('sample preserves literal user names and resets conflicting date preferences', () => {
  const { nodes } = app();
  nodes.get('your-name').value = 'Sam$&';
  nodes.get('date-format').value = 'month-first';
  nodes.get('demo-button').click();
  assert.ok(nodes.get('chat-input').value.includes('@Sam$&'));
  assert.equal(nodes.get('date-format').value, 'day-first');
  assert.equal(nodes.get('results').hidden, false);
  assert.match(nodes.get('digest-info').textContent, /^18 messages/);
  assert.equal(nodes.get('export-button').disabled, false);
});
test('worker construction failure leaves the source brief and a usable retry button', () => {
  const { nodes } = app();
  nodes.get('demo-button').click();
  nodes.get('ai-button').click();
  assert.equal(nodes.get('ai-button').disabled, false);
  assert.equal(nodes.get('summary-mode').textContent, 'Source-backed');
  assert.equal(nodes.get('results').hidden, false);
  assert.match(nodes.get('ai-status').textContent, /could not start/);
});
test('export attaches a download link and then removes it', () => {
  const { nodes, downloads, body } = app();
  nodes.get('demo-button').click();
  nodes.get('export-button').click();
  assert.deepEqual(downloads, [{ connected: true, name: 'catchup-brief.md' }]);
  assert.equal(body.children.length, 0);
});
test('mobile flow focuses results and respects reduced motion', () => {
  const { nodes } = app({ mobile: true });
  nodes.get('demo-button').click();
  assert.equal(nodes.get('results-title').focused, true);
  assert.equal(nodes.get('results-title').scroll.behavior, 'auto');
});
test('restoring a saved chat refreshes the deadline clock instead of using stale time', () => {
  const { nodes } = app({
    saved: { chat: 'Maya: Please bring your ID.', asOf: '2000-01-01T00:00' },
  });
  assert.notEqual(nodes.get('as-of').value, '2000-01-01T00:00');
  assert.equal(nodes.get('results').hidden, false);
});
