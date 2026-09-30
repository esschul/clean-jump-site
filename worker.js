// hikupuzzle.com: the site's files are served as they are; only /api/daily runs here.
//
// GET /api/daily?day=YYYY-MM-DD gives that day's four boards, the same as the app picks. The library itself is kept
// in the LIBRARY store (Cloudflare KV, key "boards") and never published, and only yesterday, today and tomorrow in
// UTC are given out: enough for every time zone to have its own today, and no more, so the boards cannot be read
// ahead or collected.

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
  const today = Math.floor(Date.now() / DAY) * DAY;
  if (Math.abs(asked - today) > DAY) return json({error: "not today"}, 403, {"cache-control": "no-store"});

  library ??= await env.LIBRARY.get("boards", "json");
  if (!library) return json({error: "library"}, 503);
  const days = Math.round((asked - FIRST_DAY) / DAY);
  const boards = {};
  for (const tier of TIERS) {
    const list = library[tier];
    boards[tier] = list[((days % list.length) + list.length) % list.length];
  }
  // The answer for a day never changes; let browsers and Cloudflare keep it for a while.
  return json({day, boards}, 200, {"cache-control": "public, max-age=600"});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/daily") return daily(url, env);
    return env.ASSETS.fetch(request);
  },
};
