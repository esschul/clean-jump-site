// hikupuzzle.com: the site's files are served as they are; only /api/daily and the homepage's choice of language run here.
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/daily") return daily(url, env);
    if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) return home(request, url, env);
    return env.ASSETS.fetch(request);
  },
};
