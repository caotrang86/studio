/* Lightweight progressive enhancement for the static mirror.
   Restores collapsible accordions (FAQ etc.) without the original app bundle.
   Safe, dependency-free, defensive. */
(function () {
  function isPanel(el) {
    if (!el || el.nodeType !== 1) return false;
    var c = el.className || '';
    if (typeof c !== 'string') return false;
    return c.indexOf('max-h-0') !== -1 ||
      (c.indexOf('overflow-hidden') !== -1 && c.indexOf('transition-all') !== -1);
  }
  function init() {
    try {
      var buttons = document.querySelectorAll('button');
      buttons.forEach(function (btn) {
        var panel = btn.nextElementSibling;
        if (!isPanel(panel)) return;
        var chevron = btn.querySelector('svg');
        btn.setAttribute('aria-expanded', 'false');
        btn.addEventListener('click', function (e) {
          e.preventDefault();
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
        });
      });
    } catch (err) { /* no-op */ }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
