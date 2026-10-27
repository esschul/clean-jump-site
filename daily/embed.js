// Dagens Hiku on any page. Put this where the game should appear:
//
//   <div data-hiku></div>
//   <script src="https://hikupuzzle.com/daily/embed.js" async></script>
//
// Options on the div: data-lang="nb", "en", "sv", "da", "fi" or "de" (without it, the language of the page around
// it, else Norwegian), data-theme="light" or "dark", data-level="easy|medium|hard|expert", and data-align="left"
// to put the game at the left instead of in the middle, data-compact to leave out the game's own title and rule, and
// data-color="#c8102e" for the site's own colour on the buttons and tabs (the board keeps its own look).
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
    // A colour as #rgb or #rrggbb; anything else is left out, and the game keeps its own.
    var color = (host.dataset.color || '').replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(color)) color = color.replace(/./g, '$&$&');
    if (/^[0-9a-f]{6}$/i.test(color)) {
      query.push('color=' + color);
      // With a colour of its own, the game takes the background it sits on: the first one set on the box or around it.
      var background = backgroundOf(host);
      if (background) query.push('bg=' + background);
    }
    // A page opened with ?debug=1 passes it on, so the game's touch log shows inside the frame too.
    if (/[?&]debug=1(&|$)/.test(location.search)) query.push('debug=1');
    var frame = document.createElement('iframe');
    frame.src = base + (query.length ? '?' + query.join('&') : '');
    var titles = {en: 'Daily Hiku', fi: 'Päivän Hiku', de: 'Hiku des Tages'};
    frame.title = titles[lang.slice(0, 2).toLowerCase()] || 'Dagens Hiku';
    frame.loading = 'lazy';
    // At most 480 pixels wide, in the middle of the space it is given unless asked to sit at the left.
    frame.style.cssText = 'display:block;width:100%;max-width:480px;height:720px;border:0;margin:' + (host.dataset.align === 'left' ? '0' : '0 auto') + ';';
    host.appendChild(frame);
    // Start at about the height the game will have, so the page does not jump when it reports its own: the board is
    // as wide as the frame, and the words and buttons around it take about 320 pixels (415 with the title and rule).
    var compact = query.indexOf('compact=1') >= 0;
    if (frame.clientWidth) frame.style.height = (frame.clientWidth + (compact ? 320 : 415)) + 'px';
  }
  // The background colour behind an element as rrggbb, from the element itself or the nearest one around it that has
  // one; null when none is set all the way up. Any colour the page uses is turned into plain red, green and blue.
  function backgroundOf(el) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    var paint = canvas.getContext('2d');
    for (; el && el.nodeType === 1; el = el.parentElement) {
      var colour = getComputedStyle(el).backgroundColor;
      if (!colour || colour === 'transparent' || /^rgba\(.*,\s*0\)$/.test(colour)) continue;
      paint.clearRect(0, 0, 1, 1);
      paint.fillStyle = colour;
      paint.fillRect(0, 0, 1, 1);
      var d = paint.getImageData(0, 0, 1, 1).data;
      if (d[3] < 250) continue;
      return [d[0], d[1], d[2]].map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join('');
    }
    return null;
  }
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'hiku:height') return;
    var frames = document.querySelectorAll('[data-hiku] iframe');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) {
        frames[i].style.height = Math.ceil(e.data.height) + 'px';
        // Any room the page held for the game is no longer needed once the frame has its own height.
        frames[i].parentNode.style.minHeight = '0';
      }
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
