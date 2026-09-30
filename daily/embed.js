// Dagens Hiku on any page. Put this where the game should appear:
//
//   <div data-hiku></div>
//   <script src="https://hikupuzzle.com/daily/embed.js" async></script>
//
// Options on the div: data-lang="nb", "en", "sv", "da", "fi" or "de" (without it, the language of the page around
// it, else Norwegian), data-theme="light" or "dark", data-level="easy|medium|hard|expert", and data-align="left"
// to put the game at the left instead of in the middle, and data-compact to leave out the game's own title and rule.
// The game runs in its own frame and sets no cookies; no game data or results are sent to us, they stay in the
// reader's browser. This script only creates the frame and sets its height.
(function () {
  var script = document.currentScript;
  var base = script ? script.src.replace(/embed\.js.*$/, '') : 'https://hikupuzzle.com/daily/';
  function mount(host) {
    if (host.dataset.hikuMounted) return;
    host.dataset.hikuMounted = '1';
    var query = [];
    // The language is the one asked for, or else the page's own: a Norwegian page gets the game in Norwegian.
    var lang = host.dataset.lang || document.documentElement.lang || 'nb';
    query.push('lang=' + encodeURIComponent(lang));
    ['theme', 'level'].forEach(function (k) { if (host.dataset[k]) query.push(k + '=' + encodeURIComponent(host.dataset[k])); });
    if (host.dataset.compact === 'true' || host.dataset.compact === '') query.push('compact=1');
    var frame = document.createElement('iframe');
    frame.src = base + (query.length ? '?' + query.join('&') : '');
    var titles = {en: 'Daily Hiku', fi: 'Päivän Hiku', de: 'Hiku des Tages'};
    frame.title = titles[lang.slice(0, 2).toLowerCase()] || 'Dagens Hiku';
    frame.loading = 'lazy';
    // At most 480 pixels wide, in the middle of the space it is given unless asked to sit at the left.
    frame.style.cssText = 'display:block;width:100%;max-width:480px;height:720px;border:0;margin:' + (host.dataset.align === 'left' ? '0' : '0 auto') + ';';
    host.appendChild(frame);
  }
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'hiku:height') return;
    var frames = document.querySelectorAll('[data-hiku] iframe');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) frames[i].style.height = Math.ceil(e.data.height) + 'px';
    }
  });
  function mountAll(root) {
    var hosts = (root || document).querySelectorAll('[data-hiku]');
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }
  mountAll();
  // Pages that add articles after loading, as many news sites do, get their games too.
  if (window.MutationObserver) {
    new MutationObserver(function () { mountAll(); }).observe(document.documentElement, {childList: true, subtree: true});
  }
  window.Hiku = {mount: mountAll};
})();
