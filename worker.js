// hikupuzzle.com: the site's files are served as they are; only /api/daily, the homepage's choice of language,
// Apple's app-site association and the MCP server for ChatGPT and Claude (/mcp) run here.
//
// GET /api/daily?day=YYYY-MM-DD gives that day's four boards, the same as the app picks. The library itself is kept
// in the LIBRARY store (Cloudflare KV, key "boards") and never published, and a day is only given out while it is
// today somewhere in the world: every time zone gets its own today, and no board can be read further ahead or
// collected.

const FIRST_DAY = Date.UTC(2026, 9, 1);
const DAY = 86400000;
const TIERS = ["easy", "medium", "hard", "expert"];
let library = null;

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...extra,
    },
  });
}

async function daily(url, env) {
  const day = url.searchParams.get("day") || "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return json({error: "day"}, 400);
  const asked = Date.UTC(+match[1], +match[2] - 1, +match[3]);
  // A day is given out only while it is today somewhere: from when it starts at UTC+14 until it ends at UTC−12.
  const now = Date.now();
  const earliest = Math.floor((now - 12 * 3600000) / DAY) * DAY, latest = Math.floor((now + 14 * 3600000) / DAY) * DAY;
  if (asked < earliest || asked > latest) return json({error: "not today"}, 403, {"cache-control": "no-store"});

  library ??= await env.LIBRARY.get("boards", "json");
  if (!library) return json({error: "library"}, 503);
  const days = Math.round((asked - FIRST_DAY) / DAY);
  const boards = {}, hints = {};
  for (const tier of TIERS) {
    const list = library[tier];
    const index = ((days % list.length) + list.length) % list.length;
    boards[tier] = list[index];
    // The square of "a good place to start", the same the app marks; a library without hints gives none.
    const hint = library.hints?.[tier]?.[index];
    if (Number.isInteger(hint)) hints[tier] = hint;
  }
  // The answer for a day never changes; let browsers and Cloudflare keep it for a while.
  return json({day, boards, hints}, 200, {"cache-control": "public, max-age=600"});
}

// The homepage is Norwegian at / and in the other languages below it. Someone arriving at / from elsewhere is sent to
// the first language their browser asks for that the site has (English when it has none of them), unless Norwegian
// comes first. No Accept-Language, as from search engines' crawlers, keeps the Norwegian page, and so does any visit
// from the site itself, so the language switcher's "Norsk" still leads there.
const SITE_LANGS = {nb: "nb", no: "nb", nn: "nb", en: "en", sv: "sv", da: "da", fi: "fi", de: "de"};

function preferred(header) {
  const asked = header.split(",").map((part, i) => {
    const [tag, ...params] = part.trim().toLowerCase().split(";");
    const q = params.map(p => p.trim()).find(p => p.startsWith("q="));
    return {lang: tag.split("-")[0], q: q ? parseFloat(q.slice(2)) || 0 : 1, i};
  }).filter(a => a.lang && a.q > 0).sort((a, b) => b.q - a.q || a.i - b.i);
  for (const a of asked) if (SITE_LANGS[a.lang]) return SITE_LANGS[a.lang];
  return asked.length ? "en" : null;
}

async function home(request, url, env) {
  const header = request.headers.get("accept-language");
  const from = request.headers.get("referer");
  let fromSite = false;
  try { fromSite = !!from && new URL(from).host === url.host; } catch (e) {}
  const lang = header && !fromSite ? preferred(header) : null;
  if (lang && lang !== "nb") {
    return new Response(null, {status: 302, headers: {location: `/${lang}/${url.search}`, vary: "Accept-Language, Referer", "cache-control": "no-store"}});
  }
  const page = await env.ASSETS.fetch(request);
  const response = new Response(page.body, page);
  response.headers.append("vary", "Accept-Language");
  return response;
}

// Tells Apple that links to the daily boards belong to Hiku: they open the app when it is installed (applinks), and
// the App Clip when it is not (appclips). Only /daily/ is claimed; every other page stays a web page.
// OpenAI's check that the ChatGPT app's MCP server belongs to this domain: the token from the plugin portal, as plain text.
const OPENAI_APPS_CHALLENGE = "UUbXbBqDFt0tmOaCwQ0IBnhIayL-K0EscBog0O7VYeU";

const APP_SITE_ASSOCIATION = {
  applinks: {details: [{appIDs: ["M43Z9C48YX.no.rubberduck.cleanjump"], components: [{"/": "/daily"}, {"/": "/daily/*"}]}]},
  appclips: {apps: ["M43Z9C48YX.no.rubberduck.cleanjump.Clip"]},
};

// ---- Hiku as an app inside ChatGPT and Claude (MCP, with the MCP Apps UI standard).
//
// POST /mcp takes JSON-RPC over Streamable HTTP, statelessly: nothing is kept between calls and nothing is asked of
// the player. play_daily_hiku shows today's boards as the web game in a frame in the conversation; hiku_rules gives
// the rules and the ways to see a trap, so the assistant can explain them. The game in the frame fetches the day's
// boards from /api/daily like every embed, and keeps results in the frame's own storage.

const MCP_WIDGET = "ui://hiku/daily-v1.html";
const SITE = "https://hikupuzzle.com";
const MCP_UI_MIME = "text/html;profile=mcp-app";
const MCP_UI_META = {
  ui: {resourceUri: MCP_WIDGET},
  "openai/outputTemplate": MCP_WIDGET,
  "openai/toolInvocation/invoking": "Setting out today's boards",
  "openai/toolInvocation/invoked": "Today's boards are ready",
  "openai/widgetAccessible": false,
};

const MCP_TOOLS = [
  {
    name: "play_daily_hiku",
    title: "Play Daily Hiku",
    description: "Show today's Daily Hiku as a playable game: four new number puzzles every day, from easy to expert. " +
      "Use it when someone wants to play Hiku, a daily puzzle, a sudoku-like logic game or a short brain teaser. " +
      "The player plays in the game itself; there is nothing to send back.",
    inputSchema: {
      type: "object",
      properties: {difficulty: {type: "string", enum: ["easy", "medium", "hard", "expert"], description: "Which of today's four boards to open. Leave out to let the player choose."}},
      additionalProperties: false,
    },
    annotations: {readOnlyHint: true, openWorldHint: false, destructiveHint: false},
    _meta: MCP_UI_META,
  },
  {
    name: "hiku_rules",
    title: "Hiku rules and tips",
    description: "The rules of Hiku and three ways to see a trap coming. Use it to explain how to play, or to help " +
      "someone who is stuck, without solving the board for them.",
    inputSchema: {type: "object", properties: {}, additionalProperties: false},
    annotations: {readOnlyHint: true, openWorldHint: false, destructiveHint: false},
  },
];

// The web game, with the settings a frame without a URL of its own needs, and a small bridge to the host: it says
// hello (ui/initialize), follows the host's light or dark, opens the board the assistant asked for, reports its
// height, and opens links through the host.
async function mcpWidget(env) {
  let html = await (await env.ASSETS.fetch(new Request(SITE + "/daily/"))).text();
  html = html.replace('href="../icon.png"', `href="${SITE}/icon.png"`);
  const setup = `<script>
  (function () {
    var asked = (navigator.language || 'en').toLowerCase().slice(0, 2);
    var lang = ['nb', 'no', 'nn', 'en', 'sv', 'da', 'fi', 'de'].indexOf(asked) >= 0 ? asked : 'en';
    window.HIKU_PARAMS = 'lang=' + lang;
    window.HIKU_SITE = window.openai ? 'chatgpt' : 'ai-app';
    window.HIKU_HOME = '${SITE}/daily/';
    var theme = window.openai && window.openai.theme;
    if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
  })();
</script>`;
  const bridge = `<script>
  (function () {
    var next = 0, waiting = {};
    function send(method, params, request) {
      var message = {jsonrpc: '2.0', method: method, params: params || {}};
      if (request) message.id = ++next;
      parent.postMessage(message, '*');
      return message.id;
    }
    function request(method, params) {
      return new Promise(function (resolve) { waiting[send(method, params, true)] = resolve; });
    }
    function theme(context) {
      if (context && (context.theme === 'dark' || context.theme === 'light')) document.documentElement.dataset.theme = context.theme;
    }
    // A board asked for by name is opened at once, past the first-visit lessons.
    function open(args) {
      var i = ['easy', 'medium', 'hard', 'expert'].indexOf(args && args.difficulty);
      if (i < 0) return;
      var lesson = document.getElementById('lesson'), skip = document.getElementById('skip');
      if (lesson && !lesson.hidden && skip) skip.click();
      setTimeout(function () {
        var tabs = document.getElementById('tabs');
        if (tabs && !tabs.hidden && tabs.children[i]) tabs.children[i].click();
      }, 50);
    }
    var main = document.querySelector('main');
    function size() { send('ui/notifications/size-changed', {height: Math.ceil(main.offsetTop + main.offsetHeight + 16)}); }
    addEventListener('message', function (event) {
      var m = event.data;
      if (!m || m.jsonrpc !== '2.0') return;
      if (m.id && waiting[m.id]) { waiting[m.id](m.result); delete waiting[m.id]; return; }
      if (m.method === 'ui/notifications/tool-input') open(m.params && m.params.arguments);
      if (m.method === 'ui/notifications/tool-result') open(m.params && m.params.structuredContent);
      if (m.method === 'ui/notifications/host-context-changed') theme(m.params);
    });
    request('ui/initialize', {protocolVersion: '2025-06-18', appInfo: {name: 'Hiku', version: '1.0.0'}, appCapabilities: {}})
      .then(function (result) { theme(result && result.hostContext); send('ui/notifications/initialized'); size(); });
    new ResizeObserver(size).observe(main);
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href^="http"]');
      if (!link) return;
      event.preventDefault();
      if (window.openai && window.openai.openExternal) window.openai.openExternal({href: link.href});
      else request('ui/open-link', {url: link.href});
    });
  })();
</script>`;
  return html.replace("<head>", "<head>" + setup).replace("</body>", bridge + "</body>");
}

async function mcpHandle(message, env) {
  const result = await (async () => {
    switch (message.method) {
      case "initialize":
        return {
          protocolVersion: message.params?.protocolVersion || "2025-06-18",
          capabilities: {tools: {listChanged: false}, resources: {listChanged: false}},
          serverInfo: {name: "hiku", title: "Hiku", version: "1.0.0"},
          instructions: "Hiku is a calm daily number puzzle. Call play_daily_hiku to show today's boards, and hiku_rules " +
            "to explain the rules or help a stuck player think, without giving the solution away.",
        };
      case "ping":
        return {};
      case "tools/list":
        return {tools: MCP_TOOLS};
      case "resources/list":
        return {resources: [{uri: MCP_WIDGET, name: "Daily Hiku", mimeType: MCP_UI_MIME}]};
      case "resources/templates/list":
        return {resourceTemplates: []};
      case "resources/read": {
        if (message.params?.uri !== MCP_WIDGET) throw {code: -32602, message: "Unknown resource"};
        return {contents: [{
          uri: MCP_WIDGET, mimeType: MCP_UI_MIME, text: await mcpWidget(env),
          _meta: {
            ui: {csp: {connectDomains: [SITE], resourceDomains: [SITE]}, prefersBorder: true},
            "openai/widgetCSP": {connect_domains: [SITE], resource_domains: [SITE]},
            "openai/widgetDescription": "Today's four Hiku boards, playable right here: drag a number onto another, or tap one and then its target.",
            "openai/widgetPrefersBorder": true,
          },
        }]};
      }
      case "tools/call": {
        const name = message.params?.name, args = message.params?.arguments || {};
        if (name === "play_daily_hiku") {
          const difficulty = ["easy", "medium", "hard", "expert"].includes(args.difficulty) ? args.difficulty : null;
          return {
            content: [{type: "text", text: "Today's Daily Hiku is shown above" + (difficulty ? `, open at the ${difficulty} board` : "") +
              ". The player plays it there; offer help with the rules if they ask, but do not solve the board for them."}],
            structuredContent: {difficulty},
            _meta: MCP_UI_META,
          };
        }
        if (name === "hiku_rules") {
          const text = await (await env.ASSETS.fetch(new Request(SITE + "/llms.txt"))).text();
          return {content: [{type: "text", text}]};
        }
        throw {code: -32602, message: "Unknown tool"};
      }
      default:
        throw {code: -32601, message: "Method not found"};
    }
  })().then(value => ({value}), error => ({error}));
  if (message.id === undefined) return null;
  return result.error
    ? {jsonrpc: "2.0", id: message.id, error: {code: result.error.code || -32603, message: result.error.message || "Error"}}
    : {jsonrpc: "2.0", id: message.id, result: result.value};
}

async function mcp(request, env) {
  const cors = {"access-control-allow-origin": "*", "access-control-allow-headers": "content-type, mcp-protocol-version, mcp-session-id", "access-control-allow-methods": "POST, OPTIONS"};
  if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: cors});
  if (request.method !== "POST") return new Response("Hiku's MCP server: POST JSON-RPC here.", {status: 405, headers: {allow: "POST", ...cors}});
  let body;
  try { body = await request.json(); } catch { return json({jsonrpc: "2.0", id: null, error: {code: -32700, message: "Parse error"}}, 400, cors); }
  const answers = (await Promise.all((Array.isArray(body) ? body : [body]).map(m => mcpHandle(m, env)))).filter(Boolean);
  if (!answers.length) return new Response(null, {status: 202, headers: cors});
  return json(Array.isArray(body) ? answers : answers[0], 200, {...cors, "cache-control": "no-store"});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/daily") return daily(url, env);
    if (url.pathname === "/mcp") return mcp(request, env);
    if (url.pathname === "/.well-known/apple-app-site-association") return json(APP_SITE_ASSOCIATION, 200, {"cache-control": "public, max-age=3600"});
    if (url.pathname === "/.well-known/openai-apps-challenge") return new Response(OPENAI_APPS_CHALLENGE, {headers: {"content-type": "text/plain; charset=utf-8"}});
    if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) return home(request, url, env);
    return env.ASSETS.fetch(request);
  },
};
