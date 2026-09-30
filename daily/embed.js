// Dagens Hiku on any page. Put this where the game should appear:
//
//   <div data-hiku></div>
//   <script src="https://esschul.github.io/clean-jump-site/daily/embed.js" async></script>
//
// Options on the div: data-lang="nb" or "en" (without it, the language of the page around it, else Norwegian),
// data-theme="light" or "dark", data-level="easy|medium|hard|expert".
// The game runs in its own frame, sets no cookies and sends nothing anywhere; results stay in the reader's browser.
(function () {
  var script = document.currentScript;
  var base = script ? script.src.replace(/embed\.js.*$/, '') : 'https://esschul.github.io/clean-jump-site/daily/';
  function mount(host) {
    if (host.dataset.hikuMounted) return;
    host.dataset.hikuMounted = '1';
    var query = [];
    // The language is the one asked for, or else the page's own: a Norwegian page gets the game in Norwegian.
    var lang = host.dataset.lang || document.documentElement.lang || 'nb';
    query.push('lang=' + encodeURIComponent(lang));
    ['theme', 'level'].forEach(function (k) { if (host.dataset[k]) query.push(k + '=' + encodeURIComponent(host.dataset[k])); });
    var frame = document.createElement('iframe');
    frame.src = base + (query.length ? '?' + query.join('&') : '');
    frame.title = /^en/i.test(lang) ? 'Daily Hiku' : 'Dagens Hiku';
    frame.loading = 'lazy';
    frame.style.cssText = 'display:block;width:100%;max-width:480px;height:720px;border:0;margin:0 auto;';
    host.appendChild(frame);
  }
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'hiku:height') return;
    var frames = document.querySelectorAll('[data-hiku] iframe');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) frames[i].style.height = Math.ceil(e.data.height) + 'px';
    }
  });
  var hosts = document.querySelectorAll('[data-hiku]');
  for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
})();
