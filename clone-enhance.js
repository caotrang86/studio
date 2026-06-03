/* Lightweight progressive enhancement for the static mirror.
   Restores collapsible accordions (FAQ etc.) without the original app bundle.
   Safe, dependency-free, defensive. */
(function () {
  var LOG_PREFIX = '[clone-enhance]';

  function warn(msg, err) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(LOG_PREFIX, msg, err || '');
    }
  }

  function isPanel(el) {
    if (!el || el.nodeType !== 1) return false;
    var c = el.className || '';
    if (typeof c !== 'string') return false;
    return c.indexOf('max-h-0') !== -1 ||
      (c.indexOf('overflow-hidden') !== -1 && c.indexOf('transition-all') !== -1);
  }

  function setupAccordionButton(btn) {
    var panel = btn.nextElementSibling;
    if (!isPanel(panel)) return;
    var chevron = btn.querySelector('svg');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function () {
      try {
        var open = btn.getAttribute('aria-expanded') === 'true';
        if (open) {
          panel.style.maxHeight = '0px';
          panel.classList.add('max-h-0');
          btn.setAttribute('aria-expanded', 'false');
          if (chevron) chevron.style.transform = '';
        } else {
          panel.classList.remove('max-h-0');
          panel.style.maxHeight = panel.scrollHeight + 'px';
          btn.setAttribute('aria-expanded', 'true');
          if (chevron) chevron.style.transform = 'rotate(180deg)';
        }
      } catch (err) {
        warn('Accordion toggle failed for button:', err);
      }
    });
  }

  function init() {
    var buttons = document.querySelectorAll('button');
    var enhancedCount = 0;
    buttons.forEach(function (btn) {
      try {
        setupAccordionButton(btn);
        if (btn.getAttribute('aria-expanded') !== null) enhancedCount++;
      } catch (err) {
        warn('Failed to set up accordion button:', err);
      }
    });
    if (enhancedCount > 0) {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug(LOG_PREFIX, 'Enhanced', enhancedCount, 'accordion(s)');
      }
    }
  }

  window.addEventListener('error', function (event) {
    warn('Unhandled error: ' + (event.message || 'unknown'), event.error || '');
  });

  window.addEventListener('unhandledrejection', function (event) {
    warn('Unhandled promise rejection:', event.reason || '');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
