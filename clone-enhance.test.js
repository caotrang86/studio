/**
 * @jest-environment jsdom
 */
const { isPanel, init } = require('./clone-enhance');

describe('isPanel', () => {
  it('returns false for null', () => {
    expect(isPanel(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPanel(undefined)).toBe(false);
  });

  it('returns false for non-element nodes (text node)', () => {
    const textNode = document.createTextNode('hello');
    expect(isPanel(textNode)).toBe(false);
  });

  it('returns false for a plain div without panel classes', () => {
    const div = document.createElement('div');
    div.className = 'some-class another-class';
    expect(isPanel(div)).toBe(false);
  });

  it('returns true for element with max-h-0 class', () => {
    const div = document.createElement('div');
    div.className = 'max-h-0 p-4';
    expect(isPanel(div)).toBe(true);
  });

  it('returns true for element with both overflow-hidden and transition-all', () => {
    const div = document.createElement('div');
    div.className = 'overflow-hidden transition-all duration-300';
    expect(isPanel(div)).toBe(true);
  });

  it('returns false for element with only overflow-hidden (no transition-all)', () => {
    const div = document.createElement('div');
    div.className = 'overflow-hidden';
    expect(isPanel(div)).toBe(false);
  });

  it('returns false for element with only transition-all (no overflow-hidden)', () => {
    const div = document.createElement('div');
    div.className = 'transition-all';
    expect(isPanel(div)).toBe(false);
  });

  it('returns false for element with empty className', () => {
    const div = document.createElement('div');
    div.className = '';
    expect(isPanel(div)).toBe(false);
  });

  it('handles element where className is not a string (SVG animated)', () => {
    const el = { nodeType: 1, className: {} };
    expect(isPanel(el)).toBe(false);
  });
});

describe('init', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('sets aria-expanded=false on buttons with adjacent panel', () => {
    document.body.innerHTML = `
      <button id="btn1">Toggle</button>
      <div class="max-h-0">Panel content</div>
    `;
    init();
    const btn = document.getElementById('btn1');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not set aria-expanded on buttons without adjacent panel', () => {
    document.body.innerHTML = `
      <button id="btn1">Regular button</button>
      <div class="some-class">Not a panel</div>
    `;
    init();
    const btn = document.getElementById('btn1');
    expect(btn.getAttribute('aria-expanded')).toBeNull();
  });

  it('expands panel on click (sets aria-expanded=true, removes max-h-0)', () => {
    document.body.innerHTML = `
      <button id="btn1">Toggle</button>
      <div class="max-h-0" id="panel1">Panel content</div>
    `;
    init();
    const btn = document.getElementById('btn1');
    const panel = document.getElementById('panel1');

    btn.click();

    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(panel.classList.contains('max-h-0')).toBe(false);
  });

  it('collapses panel on second click (sets aria-expanded=false, adds max-h-0)', () => {
    document.body.innerHTML = `
      <button id="btn1">Toggle</button>
      <div class="max-h-0" id="panel1">Panel content</div>
    `;
    init();
    const btn = document.getElementById('btn1');
    const panel = document.getElementById('panel1');

    btn.click(); // expand
    btn.click(); // collapse

    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(panel.classList.contains('max-h-0')).toBe(true);
    expect(panel.style.maxHeight).toBe('0px');
  });

  it('rotates chevron SVG on expand and resets on collapse', () => {
    document.body.innerHTML = `
      <button id="btn1"><svg id="chevron"></svg> Toggle</button>
      <div class="max-h-0" id="panel1">Panel content</div>
    `;
    init();
    const btn = document.getElementById('btn1');
    const chevron = document.getElementById('chevron');

    btn.click(); // expand
    expect(chevron.style.transform).toBe('rotate(180deg)');

    btn.click(); // collapse
    expect(chevron.style.transform).toBe('');
  });

  it('works without chevron SVG (no error thrown)', () => {
    document.body.innerHTML = `
      <button id="btn1">Toggle</button>
      <div class="max-h-0" id="panel1">Panel content</div>
    `;
    init();
    const btn = document.getElementById('btn1');

    expect(() => btn.click()).not.toThrow();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('handles multiple accordion buttons independently', () => {
    document.body.innerHTML = `
      <button id="btn1">FAQ 1</button>
      <div class="max-h-0" id="panel1">Answer 1</div>
      <button id="btn2">FAQ 2</button>
      <div class="overflow-hidden transition-all" id="panel2">Answer 2</div>
    `;
    init();
    const btn1 = document.getElementById('btn1');
    const btn2 = document.getElementById('btn2');

    btn1.click();
    expect(btn1.getAttribute('aria-expanded')).toBe('true');
    expect(btn2.getAttribute('aria-expanded')).toBe('false');

    btn2.click();
    expect(btn1.getAttribute('aria-expanded')).toBe('true');
    expect(btn2.getAttribute('aria-expanded')).toBe('true');
  });

  it('skips buttons whose next sibling is not a panel', () => {
    document.body.innerHTML = `
      <button id="btn-nav">Menu</button>
      <nav>Navigation</nav>
      <button id="btn-faq">FAQ</button>
      <div class="max-h-0">Answer</div>
    `;
    init();
    const btnNav = document.getElementById('btn-nav');
    const btnFaq = document.getElementById('btn-faq');

    expect(btnNav.getAttribute('aria-expanded')).toBeNull();
    expect(btnFaq.getAttribute('aria-expanded')).toBe('false');
  });

  it('sets maxHeight to scrollHeight when expanding', () => {
    document.body.innerHTML = `
      <button id="btn1">Toggle</button>
      <div class="max-h-0" id="panel1" style="height: 100px;">Panel content</div>
    `;
    init();
    const btn = document.getElementById('btn1');
    const panel = document.getElementById('panel1');

    // jsdom scrollHeight defaults to 0, but we verify the property is set
    btn.click();
    expect(panel.style.maxHeight).toBe(panel.scrollHeight + 'px');
  });

  it('does not throw when no buttons exist', () => {
    document.body.innerHTML = '<p>No buttons here</p>';
    expect(() => init()).not.toThrow();
  });

  it('does not throw when button has no next sibling', () => {
    document.body.innerHTML = '<button>Orphan</button>';
    expect(() => init()).not.toThrow();
  });

  it('prevents default on click event', () => {
    document.body.innerHTML = `
      <button id="btn1">Toggle</button>
      <div class="max-h-0">Panel</div>
    `;
    init();
    const btn = document.getElementById('btn1');

    const event = new Event('click', { cancelable: true });
    btn.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

describe('auto-initialization', () => {
  it('calls init via DOMContentLoaded when readyState is loading', () => {
    // Re-require the module with readyState = 'loading'
    jest.resetModules();

    const addEventSpy = jest.spyOn(document, 'addEventListener');
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
      configurable: true,
    });

    require('./clone-enhance');

    expect(addEventSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
    addEventSpy.mockRestore();

    // Restore readyState
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      writable: true,
      configurable: true,
    });
  });
});
