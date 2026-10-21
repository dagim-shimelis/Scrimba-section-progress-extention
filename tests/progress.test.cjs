const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../progress.js'), 'utf8');

function page({ expanded = 'false', visible = false } = {}) {
  let now = 0;
  let observer;
  let widget;
  const frames = [];
  const timers = new Map();
  const listeners = {};
  let timerId = 0;
  const state = { ready: false, clicks: 0, timer: true };
  const location = { pathname: '/course/~lesson' };
  const toc = {
    isConnected: true,
    getAttribute: () => expanded,
    dispatchEvent() {
      state.clicks++;
      expanded = expanded === 'true' ? 'false' : 'true';
    },
  };
  const header = {
    querySelectorAll: () => [{ textContent: '42%' }],
    querySelector: (selector) => ({ textContent: selector === '.duration' ? '2 hrs' : 'Section' }),
  };
  const group = { querySelector: () => header, getClientRects: () => visible ? [1] : [] };
  const lesson = { dataset: { id: '~lesson' }, closest: () => group };
  const timer = { after(value) { widget = value; value.previousElementSibling = timer; } };
  const document = {
    documentElement: {},
    addEventListener(type, listener) { listeners[type] = listener; },
    querySelector(selector) {
      if (selector === '.breadcrumbs .toc') return toc;
      if (selector.includes('scrim-clip-time-labels')) return state.timer ? timer : null;
      return widget;
    },
    querySelectorAll(selector) {
      if (selector === 'toc-group') return [group];
      return state.ready ? [lesson] : [];
    },
    createElement() {
      const children = new Map();
      return {
        setAttribute() {},
        querySelector(selector) {
          if (!children.has(selector)) children.set(selector, { style: {} });
          return children.get(selector);
        },
        remove() { widget = undefined; },
      };
    },
  };
  vm.runInNewContext(source, {
    document, location,
    window: { addEventListener() {} },
    Date: { now: () => now },
    PointerEvent: class {},
    MutationObserver: class { constructor(callback) { observer = callback; } observe() {} },
    requestAnimationFrame(callback) { frames.push(callback); },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, due: now + delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  });
  function flush() { while (frames.length) frames.shift()(); }
  function change() { observer([{ target: {} }]); flush(); }
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const next = [...timers].filter(([, t]) => t.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      now = next[1].due;
      timers.delete(next[0]);
      next[1].callback();
      flush();
    }
    now = end;
  }
  flush();
  return { state, toc, location, change, advance, interact(type = 'pointerdown', isTrusted = true) {
    listeners[type]({ isTrusted });
  }, get expanded() { return expanded; }, get widget() { return widget; } };
}

test('reads progress and closes only its own opened outline', () => {
  const p = page();
  assert.equal(p.state.clicks, 1);
  p.state.ready = true;
  p.change();
  assert.equal(p.state.clicks, 2);
  assert.equal(p.expanded, 'false');
  assert.equal(p.widget.querySelector('.cookie-section-progress__percent').textContent, '42%');
  assert.equal(p.widget.querySelector('.cookie-section-progress__time').textContent, '≈50 min / 2 hrs');
  p.advance(10000);
  assert.equal(p.state.clicks, 2);
});

test('leaves an already-open outline open', () => {
  const p = page({ expanded: 'true' });
  p.state.ready = true;
  p.change();
  assert.equal(p.state.clicks, 0);
  assert.ok(p.widget);
});

test('unknown panel state waits for a manual open and then reads data', () => {
  const p = page({ expanded: null });
  p.advance(10000);
  assert.equal(p.state.clicks, 0);
  p.state.ready = true;
  p.change();
  assert.ok(p.widget);
  assert.equal(p.state.clicks, 0);
});

for (const type of ['pointerdown', 'keydown']) {
  test(`${type} hands panel control back to the user`, () => {
    const p = page();
    p.interact(type);
    p.state.ready = true;
    p.change();
    p.advance(10000);
    assert.equal(p.state.clicks, 1);
    assert.equal(p.expanded, 'true');
  });
}

test('navigation prevents an old timeout from toggling the new lesson outline', () => {
  const p = page();
  p.location.pathname = '/course/~another';
  p.advance(1500);
  assert.equal(p.state.clicks, 1);
});

test('detached outline control is never toggled by timeout', () => {
  const p = page();
  p.toc.isConnected = false;
  p.advance(1500);
  assert.equal(p.state.clicks, 1);
});

test('failed reads retry once after a delay, then stop', () => {
  const p = page();
  p.advance(1500);
  assert.equal(p.state.clicks, 2);
  p.advance(4999);
  assert.equal(p.state.clicks, 2);
  p.advance(1);
  assert.equal(p.state.clicks, 3);
  p.advance(1500);
  assert.equal(p.state.clicks, 4);
  p.advance(60000);
  p.change();
  assert.equal(p.state.clicks, 4);
});

test('a late section read after timeout still populates the badge', () => {
  const p = page();
  p.advance(1500);
  p.state.ready = true;
  p.change();
  assert.ok(p.widget);
  p.advance(10000);
  assert.equal(p.state.clicks, 2);
});


test('user interaction during the retry delay cancels the retry', () => {
  const p = page();
  p.advance(1500);
  p.interact();
  p.advance(10000);
  assert.equal(p.state.clicks, 2);
});

test('synthetic events do not cancel extension-owned cleanup', () => {
  const p = page();
  p.interact('pointerdown', false);
  p.state.ready = true;
  p.change();
  assert.equal(p.state.clicks, 2);
});
