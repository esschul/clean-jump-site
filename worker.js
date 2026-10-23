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
  const found = await dayBoards(env, day);
  if (found.error === "day") return json({error: "day"}, 400);
  if (found.error === "not today") return json({error: "not today"}, 403, {"cache-control": "no-store"});
  if (found.error) return json({error: found.error}, 503);
  // The answer for a day never changes; let browsers and Cloudflare keep it for a while.
  return json({day, boards: found.boards, hints: found.hints}, 200, {"cache-control": "public, max-age=600"});
}

/** The four boards of a day, as "size digit + squares", with their start hints; or {error}. */
async function dayBoards(env, day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return {error: "day"};
  const asked = Date.UTC(+match[1], +match[2] - 1, +match[3]);
  // A day is given out only while it is today somewhere: from when it starts at UTC+14 until it ends at UTC−12.
  const now = Date.now();
  const earliest = Math.floor((now - 12 * 3600000) / DAY) * DAY, latest = Math.floor((now + 14 * 3600000) / DAY) * DAY;
  if (asked < earliest || asked > latest) return {error: "not today"};

  library ??= await env.LIBRARY.get("boards", "json");
  if (!library) return {error: "library"};
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
  return {boards, hints};
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

// The version in the name changes whenever the game in the frame changes: hosts keep a copy of a template by its name.
const MCP_WIDGET = "ui://hiku/daily-v2.html";
const SITE = "https://hikupuzzle.com";
const MCP_UI_MIME = "text/html;profile=mcp-app";
const MCP_UI_META = {
  ui: {resourceUri: MCP_WIDGET},
  "openai/outputTemplate": MCP_WIDGET,
  "openai/toolInvocation/invoking": "Setting out today's boards",
  "openai/toolInvocation/invoked": "Today's boards are ready",
  "openai/widgetAccessible": false,
};

// Today in UTC, as the day to use when the assistant does not say which; the player's own today can differ near midnight.
const utcToday = () => new Date().toISOString().slice(0, 10);
const dayArg = {type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "The player's date today, YYYY-MM-DD. Leave out for today in UTC."};
const movesArg = {type: "array", items: {type: "string", pattern: "^[A-Ha-h][1-8]-[A-Ha-h][1-8]$"},
  description: "Moves already made on this board from its start, in order, each as \"from-to\" squares like \"B2-E2\" (columns A, B, C … from the left, rows 1, 2, 3 … from the top)."};

// The rules in one breath, given with every board so the assistant never has to recall them.
const HIKU_RULES_SHORT = "Rules: a number jumps exactly as many squares as it shows, across or up and down, over anything " +
  "in between, and must land on another number. The smaller is taken from the larger and the rest stays where it " +
  "landed; equal numbers both vanish. The goal is to clear the board: every number must vanish, none left over.";

const MCP_TOOLS = [
  {
    name: "play_daily_hiku",
    title: "Play Daily Hiku",
    description: "Show today's Daily Hiku as a playable game for the player: four new number puzzles every day, from " +
      "easy to expert. Use it when someone wants to play Hiku, a daily puzzle, a sudoku-like logic game or a short " +
      "brain teaser; \"play Hiku\" means the player plays, so open the board and make no moves. With a difficulty it " +
      "also returns that board as a grid with its legal moves, so you can see it. Only when the player clearly asks you " +
      "to play, solve or show moves for them, pass moves: work out all of them first (hiku_hint), then call this once " +
      "with the whole list, and the game plays them on the board. The moves the player makes come back to you as the " +
      "game's state.",
    inputSchema: {
      type: "object",
      properties: {
        difficulty: {type: "string", enum: ["easy", "medium", "hard", "expert"], description: "Which of today's four boards to open. Leave out to let the player choose."},
        moves: movesArg,
        day: dayArg,
      },
      additionalProperties: false,
    },
    annotations: {title: "Play Daily Hiku", readOnlyHint: true, openWorldHint: false, destructiveHint: false},
    _meta: MCP_UI_META,
  },
  {
    name: "hiku_hint",
    title: "Hiku hint",
    description: "A good next move on one of today's boards, worked out by Hiku's own solver, so it never leads into a " +
      "trap: which number to move, where it lands and what is left. Give the moves made so far to get a move from the " +
      "board as it stands. If the board can no longer be cleared, it says how many moves to undo. Give the player the " +
      "move as a tip; only when they asked you to play or solve it, show it with play_daily_hiku.",
    inputSchema: {
      type: "object",
      properties: {
        difficulty: {type: "string", enum: ["easy", "medium", "hard", "expert"], description: "Which of today's boards."},
        moves: movesArg,
        day: dayArg,
      },
      required: ["difficulty"],
      additionalProperties: false,
    },
    annotations: {title: "Hiku hint", readOnlyHint: true, openWorldHint: false, destructiveHint: false},
  },
  {
    name: "hiku_analyze",
    title: "Analyse a Hiku position",
    description: "Hiku's solver explains a position, so you can think it through with the player: for one move, whether " +
      "the board can still be cleared after it and, if not, why (a number left with no partner, numbers that can never " +
      "meet adding up to an odd sum, or a line showing how every way on runs out); without a move, every legal move " +
      "marked safe or a trap with a short reason, and what each number can reach and be reached by. Use it to discuss " +
      "strategy and answer \"why not this one?\", revealing only as much as the player wants.",
    inputSchema: {
      type: "object",
      properties: {
        difficulty: {type: "string", enum: ["easy", "medium", "hard", "expert"], description: "Which of today's boards."},
        moves: movesArg,
        move: {type: "string", pattern: "^[A-Ha-h][1-8]-[A-Ha-h][1-8]$", description: "A move to judge, as \"B2-E2\". Leave out for the whole position."},
        day: dayArg,
      },
      required: ["difficulty"],
      additionalProperties: false,
    },
    annotations: {title: "Analyse a Hiku position", readOnlyHint: true, openWorldHint: false, destructiveHint: false},
  },
  {
    name: "hiku_rules",
    title: "Hiku rules and tips",
    description: "The rules of Hiku and three ways to see a trap coming. Use it to explain how to play, or to help " +
      "someone who is stuck think for themselves.",
    inputSchema: {type: "object", properties: {}, additionalProperties: false},
    annotations: {title: "Hiku rules and tips", readOnlyHint: true, openWorldHint: false, destructiveHint: false},
  },
];

// ---- The rules and the solver, as in the web game (daily/index.html): a number jumps exactly its value across or up
// and down onto another number, the smaller is taken from the larger, and equal numbers both vanish. Numbers that
// share no row or column never meet, so each such group is solved on its own.
const HIKU_DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];
function hikuTargets(cells, n, i) {
  const v = cells[i], r = Math.floor(i / n), c = i % n, out = [];
  if (!v) return out;
  for (const [dr, dc] of HIKU_DIRS) {
    const rr = r + dr * v, cc = c + dc * v;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n && cells[rr * n + cc] > 0) out.push(rr * n + cc);
  }
  return out;
}
function hikuMoved(cells, from, to) {
  const next = cells.slice();
  next[to] = Math.abs(cells[from] - cells[to]);
  next[from] = 0;
  return next;
}
function hikuGroups(cells, n) {
  const parent = [...Array(2 * n).keys()];
  const find = x => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
  const occ = [];
  cells.forEach((v, i) => { if (v) { occ.push(i); const a = find(Math.floor(i / n)), b = find(n + i % n); if (a !== b) parent[a] = b; } });
  const by = new Map();
  for (const i of occ) { const k = find(Math.floor(i / n)); if (!by.has(k)) by.set(k, []); by.get(k).push(i); }
  return [...by.values()];
}
/** true when the board can be cleared, false when it cannot, null when the search gave up past its budget. */
function hikuSolvable(cells, n, memo, budget) {
  let left = budget;
  function search(p) {
    const key = p.join("");
    if (memo.has(key)) return memo.get(key);
    if (p.every(v => v === 0)) return true;
    if (left <= 0) return null;
    left--;
    const parts = hikuGroups(p, n);
    if (parts.length > 1 || parts[0].length === 1) {
      for (const part of parts) {
        if (part.length === 1 || part.reduce((sum, i) => sum + p[i], 0) % 2) { memo.set(key, false); return false; }
      }
      if (parts.length > 1) {
        let gaveUp = false;
        for (const part of parts.sort((a, b) => a.length - b.length)) {
          const q = new Array(p.length).fill(0);
          for (const i of part) q[i] = p[i];
          const r = search(q);
          if (r === false) { memo.set(key, false); return false; }
          if (r === null) gaveUp = true;
        }
        if (gaveUp) return null;
        memo.set(key, true);
        return true;
      }
    }
    let gaveUp = false;
    for (let i = 0; i < p.length; i++) {
      for (const t of hikuTargets(p, n, i)) {
        const r = search(hikuMoved(p, i, t));
        if (r === true) { memo.set(key, true); return true; }
        if (r === null) gaveUp = true;
      }
    }
    if (gaveUp) return null;
    memo.set(key, false);
    return false;
  }
  return search(cells);
}

const squareName = (n, i) => String.fromCharCode(65 + i % n) + (Math.floor(i / n) + 1);
const squareIndex = (n, name) => {
  const m = /^([A-Z])(\d+)$/.exec(String(name).trim().toUpperCase());
  if (!m) return -1;
  const c = m[1].charCodeAt(0) - 65, r = +m[2] - 1;
  return c < n && r >= 0 && r < n ? r * n + c : -1;
};
function boardGrid(n, cells) {
  const head = "    " + Array.from({length: n}, (_, c) => String.fromCharCode(65 + c)).join(" ");
  const rows = Array.from({length: n}, (_, r) => String(r + 1).padStart(2) + "  " + cells.slice(r * n, r * n + n).map(v => v || ".").join(" "));
  return [head, ...rows].join("\n");
}
function describeMove(n, cells, from, to) {
  const a = cells[from], b = cells[to], fr = Math.floor(from / n), tr = Math.floor(to / n);
  const way = fr === tr ? (to > from ? "right" : "left") : (tr > fr ? "down" : "up");
  const squares = a === 1 ? "one square" : `${a} squares`;
  const result = a === b ? `both ${a}s vanish` : `${Math.max(a, b)} − ${Math.min(a, b)} leaves ${Math.abs(a - b)} on ${squareName(n, to)}`;
  return `${squareName(n, from)}-${squareName(n, to)}: the ${a} on ${squareName(n, from)} jumps ${squares} ${way} onto the ${b} on ${squareName(n, to)}, and ${result}`;
}

/** Why a position plainly cannot be cleared, in words, or null when nothing shows it at a glance. */
function plainlyLost(cells, n) {
  const left = cells.filter(v => v).length;
  if (!left) return null;
  const parts = hikuGroups(cells, n);
  for (const part of parts) {
    const names = part.map(i => `${cells[i]} on ${squareName(n, i)}`);
    if (part.length === 1) return `the ${names[0]} has no row or column with another number in it, so nothing can ever reach it`;
  }
  if (parts.length > 1) {
    for (const part of parts) {
      const sum = part.reduce((s, i) => s + cells[i], 0);
      if (sum % 2) return `the numbers ${part.map(i => `${cells[i]} on ${squareName(n, i)}`).join(", ")} share no row or column with the rest, ` +
        `so they can only meet each other, and their sum ${sum} is odd: one number will always be left`;
    }
  }
  if (!cells.some((v, i) => v && hikuTargets(cells, n, i).length)) return `no number can move, and ${left} are left`;
  return null;
}

/** For a position that cannot be cleared: the shortest line of moves to a position that plainly cannot, with why. */
function lostLine(cells, n) {
  const start = plainlyLost(cells, n);
  if (start) return {line: [], why: start};
  const seen = new Set([cells.join("")]);
  let frontier = [{cells, line: []}], visited = 0;
  for (let depth = 0; depth < 8 && frontier.length && visited < 30000; depth++) {
    const next = [];
    for (const {cells: p, line} of frontier) {
      for (let i = 0; i < p.length; i++) for (const t of hikuTargets(p, n, i)) {
        const q = hikuMoved(p, i, t), key = q.join("");
        if (seen.has(key)) continue;
        seen.add(key); visited++;
        const step = [...line, squareName(n, i) + "-" + squareName(n, t)], why = plainlyLost(q, n);
        if (why) return {line: step, why};
        next.push({cells: q, line: step});
      }
    }
    frontier = next;
  }
  return null;
}

/** The solver's verdict on a move, with the reason in words. */
function judgeMove(b, from, to, memo) {
  const n = b.n, after = hikuMoved(b.cells, from, to), what = describeMove(n, b.cells, from, to);
  const ok = hikuSolvable(after, n, memo, 400_000);
  if (ok === true) return {safe: true, text: `${what}. Safe: the board can still be cleared after it.`};
  if (ok === null) return {safe: null, text: `${what}. The solver could not settle it in time.`};
  const shown = lostLine(after, n);
  if (!shown) return {safe: false, text: `${what}. A trap: the board can no longer be cleared after it, though the reason lies many moves ahead.`};
  if (!shown.line.length) return {safe: false, text: `${what}. A trap, at once: ${shown.why}.`};
  return {safe: false, text: `${what}. A trap: every way on from here runs out. One example, the shortest: ${shown.line.join(", ")}, and then ${shown.why}.`};
}

function analyseText(difficulty, b, move) {
  const n = b.n, memo = new Map();
  if (b.cells.every(v => v === 0)) return "This board is already cleared.";
  if (move) {
    const [a, t] = String(move).split("-").map(sq => squareIndex(n, sq));
    if (a < 0 || t < 0 || !hikuTargets(b.cells, n, a).includes(t)) return `${move} is not a legal move here. ` + boardText(difficulty, b);
    return judgeMove(b, a, t, memo).text;
  }
  const now = hikuSolvable(b.cells, n, memo, 400_000);
  const lines = [boardText(difficulty, b).split("\n").slice(0, n + 3).join("\n"), ""];
  if (now === false) {
    const shown = lostLine(b.cells, n);
    lines.push("This position can no longer be cleared" + (shown ? (shown.line.length ? `: for example ${shown.line.join(", ")}, and then ${shown.why}.` : `: ${shown.why}.`) : "."));
    return lines.join("\n");
  }
  lines.push("Each legal move:");
  b.cells.forEach((v, i) => hikuTargets(b.cells, n, i).forEach(t => {
    const j = judgeMove(b, i, t, memo);
    lines.push("• " + (j.safe === true ? "SAFE " : j.safe === false ? "TRAP " : "? ") + j.text);
  }));
  lines.push("", "What each number can reach, and what can reach it:");
  b.cells.forEach((v, i) => {
    if (!v) return;
    const reach = hikuTargets(b.cells, n, i).map(t => squareName(n, t));
    const reachedBy = b.cells.map((w, k) => k).filter(k => b.cells[k] && hikuTargets(b.cells, n, k).includes(i)).map(k => squareName(n, k));
    lines.push(`• ${v} on ${squareName(n, i)}: reaches ${reach.join(", ") || "nothing"}; reached by ${reachedBy.join(", ") || "nothing"}`);
  });
  return lines.join("\n");
}

/** Today's board of a difficulty after the given moves: {day, n, cells, played, error}. Stops at the first illegal move. */
async function boardAfter(env, difficulty, moves, day) {
  const found = await dayBoards(env, day);
  if (found.error) return {error: found.error === "not today" ? `${day} is not today anywhere in the world, so its boards are not out.` : "Today's boards could not be read."};
  const text = found.boards[difficulty], n = +text[0];
  const start = [...text.slice(1)].map(Number);
  let cells = start;
  const played = [];
  for (const move of moves || []) {
    const [a, b] = String(move).split("-").map(sq => squareIndex(n, sq));
    if (a < 0 || b < 0 || !hikuTargets(cells, n, a).includes(b)) {
      return {day, n, start, cells, played, error: `${move} is not a legal move on the board after ${played.length ? played.join(", ") : "no moves"}.`};
    }
    cells = hikuMoved(cells, a, b);
    played.push(squareName(n, a) + "-" + squareName(n, b));
  }
  return {day, n, start, cells, played, hint: found.hints[difficulty]};
}

function boardText(difficulty, b) {
  const left = b.cells.filter(v => v).length;
  const moves = [];
  b.cells.forEach((v, i) => hikuTargets(b.cells, b.n, i).forEach(t => moves.push(describeMove(b.n, b.cells, i, t))));
  const lines = [`Today's ${difficulty} board (${b.day}), ${b.n}×${b.n}, after ${b.played.length ? b.played.join(", ") : "no moves"}:`, "", boardGrid(b.n, b.cells), ""];
  if (!left) lines.push("The board is cleared.");
  else if (!moves.length) lines.push(`${left} numbers are left and none can move: this board is lost. Undo some moves and try another way.`);
  else lines.push(`${left} numbers left. Legal moves (not all of them keep the board clearable):`, ...moves.map(m => "• " + m));
  return lines.join("\n");
}

function hintText(difficulty, b) {
  const n = b.n, memo = new Map(), budget = 400_000;
  if (b.cells.every(v => v === 0)) return "This board is already cleared.";
  const now = hikuSolvable(b.cells, n, memo, budget);
  if (now === false) {
    // How far back the board could still be cleared: replay the moves from the start and find the last good position.
    const positions = [b.start];
    for (const move of b.played) {
      const [a, t] = move.split("-").map(sq => squareIndex(n, sq));
      positions.push(hikuMoved(positions[positions.length - 1], a, t));
    }
    for (let k = positions.length - 2; k >= 0; k--) {
      if (hikuSolvable(positions[k], n, memo, budget) === true) {
        const undo = b.played.length - k;
        return `The board can no longer be cleared: the mistake was ${b.played[k]}. Undo ${undo === 1 ? "the last move" : `the last ${undo} moves`} ` +
          `(back to after ${k ? b.played.slice(0, k).join(", ") : "no moves"}) and ask for a hint from there.`;
      }
    }
    return "This board cannot be cleared from here; start it over.";
  }
  let best = null;
  b.cells.forEach((v, i) => {
    if (!v) return;
    const safe = hikuTargets(b.cells, n, i).filter(t => hikuSolvable(hikuMoved(b.cells, i, t), n, memo, budget) === true);
    if (safe.length && (!best || safe.length < best.safe.length)) best = {from: i, safe};
  });
  if (!best) return "The solver could not settle this position in time. Try the rules' tips, or ask again after another move.";
  return `A good next move on today's ${difficulty} board: ${describeMove(n, b.cells, best.from, best.safe[0])}. ` +
    `The board can still be cleared after it.` + (best.safe.length === 1 ? ` It is the only safe way to move the ${b.cells[best.from]} on ${squareName(n, best.from)}.` : "");
}

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
    window.HIKU_PARAMS = 'lang=' + lang + '&lessons=0&compact=1';
    // Inside a conversation the game is told what it is already: no title or rule, a tighter page, and the
    // "learn to play" link beside the app's at the bottom instead of a line of its own.
    document.documentElement.classList.add('in-ai');
    var style = document.createElement('style');
    style.textContent = '.in-ai main{padding:12px 14px 10px}.in-ai #made{display:none}.in-ai .replay{display:none}' +
      '.in-ai footer{margin-top:12px;justify-content:space-between}.in-ai footer .linky{font-size:13px}';
    document.head.appendChild(style);
    addEventListener('DOMContentLoaded', function () {
      var replay = document.getElementById('replay'), footer = document.querySelector('footer');
      if (replay && footer) footer.insertBefore(replay, footer.firstChild);
    });
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
    // A board asked for by name is opened at once, past the first-visit lessons, and any moves the assistant sent are
    // played on it one by one, so the player sees them happen. Waits for the day's boards if they have not come yet.
    var replaying = null, lastOpened = '';
    function open(args, tries) {
      if (!args || !args.difficulty || !window.HikuGame) return;
      // The same call can arrive both as an MCP notification and through window.openai: play it once.
      var key = args.difficulty + ' ' + (args.moves || []).join(' ');
      if (!tries) { if (key === lastOpened) return; lastOpened = key; }
      if (!window.HikuGame.open(args.difficulty)) {
        if ((tries || 0) < 40) setTimeout(function () { open(args, (tries || 0) + 1); }, 150);
        return;
      }
      var moves = args.moves || [];
      if (!moves.length) return;
      var current = window.HikuGame.state();
      // Already at that position (the same moves were made here): nothing to replay.
      if (current && current.moves.join(' ') === moves.join(' ')) return;
      window.HikuGame.restart();
      var k = 0, tries = 0, run = replaying = {};
      (function step() {
        // A move that will not go (another day's board near midnight) stops the replay instead of trying forever.
        if (replaying !== run || k >= moves.length || tries > 8) return;
        if (window.HikuGame.move(moves[k])) { k++; tries = 0; } else tries++;
        setTimeout(step, 420);
      })();
    }
    // The board as it stands, to the host, so the assistant sees the player's own moves too.
    var lastSent = '';
    addEventListener('hiku:state', function (event) {
      var s = event.detail, key = JSON.stringify(s);
      if (key === lastSent) return;
      lastSent = key;
      var text = "The player's " + s.difficulty + ' board (' + s.day + ') after ' + (s.moves.length ? s.moves.join(', ') : 'no moves') +
        ': rows from the top ' + s.rows.join(' / ') + (s.cleared ? ', cleared.' : s.lost ? ', no longer clearable.' : ', ' + s.left + ' numbers left.');
      if (window.openai && window.openai.setWidgetState) window.openai.setWidgetState(s);
      send('ui/update-model-context', {content: [{type: 'text', text: text}], structuredContent: s}, true);
    });
    var main = document.querySelector('main');
    function size() { send('ui/notifications/size-changed', {height: Math.ceil(main.offsetTop + main.offsetHeight + 16)}); }
    addEventListener('message', function (event) {
      var m = event.data;
      if (!m || m.jsonrpc !== '2.0') return;
      if (m.id && waiting[m.id]) { waiting[m.id](m.result); delete waiting[m.id]; return; }
      if (m.method === 'ui/notifications/tool-input') open({difficulty: m.params && m.params.arguments && m.params.arguments.difficulty});
      if (m.method === 'ui/notifications/tool-result') open(m.params && m.params.structuredContent);
      if (m.method === 'ui/notifications/host-context-changed') theme(m.params);
    });
    // ChatGPT also hands the tool's input and result to the frame as window.openai.toolInput and toolOutput, and says
    // when they change with an openai:set_globals event; it may not send the MCP Apps notifications at all.
    var seen = '';
    function fromOpenAI() {
      var o = window.openai;
      if (!o) return;
      var args = o.toolOutput && o.toolOutput.difficulty ? o.toolOutput : o.toolInput && o.toolInput.difficulty ? {difficulty: o.toolInput.difficulty, moves: []} : null;
      var key = JSON.stringify(args);
      if (!args || key === seen) return;
      seen = key;
      open(args);
    }
    addEventListener('openai:set_globals', fromOpenAI);
    fromOpenAI();
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
          instructions: "Hiku is a calm daily number puzzle for the player to play. " + HIKU_RULES_SHORT + " Call play_daily_hiku to show today's " +
            "boards and let the player play; with a difficulty it also gives you the board as a grid. Make moves only when " +
            "the player asks you to play or solve a board for them: then work out every move first and call " +
            "play_daily_hiku once with all of them, so the game shows them. " +
            "To think a board through with the player (why a number cannot be taken, whether a move is a trap), use " +
            "hiku_analyze, which gives the solver's verdict and the reason; don't guess. " +
            "Use hiku_hint for a move from Hiku's own solver rather than working one out, and hiku_rules " +
            "to explain the rules. Moves are written \"B2-E2\": columns A, B, C … from the left, rows 1, 2, 3 … from the top.",
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
            "openai/widgetDomain": SITE,
          },
        }]};
      }
      case "tools/call": {
        const name = message.params?.name, args = message.params?.arguments || {};
        const day = typeof args.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.day) ? args.day : utcToday();
        const moves = Array.isArray(args.moves) ? args.moves.slice(0, 64).map(String) : [];
        if (name === "play_daily_hiku") {
          const difficulty = TIERS.includes(args.difficulty) ? args.difficulty : null;
          if (!difficulty) {
            return {
              content: [{type: "text", text: "Today's Daily Hiku is shown above: four boards, easy to expert, for the player to play. " +
                HIKU_RULES_SHORT + " Call play_daily_hiku with a difficulty to see one of them as a grid."}],
              structuredContent: {difficulty: null, moves: [], day},
              _meta: MCP_UI_META,
            };
          }
          const b = await boardAfter(env, difficulty, moves, day);
          if (!b.n) return {content: [{type: "text", text: b.error}], isError: true};
          return {
            content: [{type: "text", text: (b.error ? b.error + " The moves before it were played.\n\n" : "") + HIKU_RULES_SHORT + "\n\n" + boardText(difficulty, b) +
              "\n\nThe game above shows this board for the player to play. Do not make moves unless they asked you to; " +
              "their own moves reach you as the game's state."}],
            structuredContent: {difficulty, moves: b.played, day: b.day},
            _meta: MCP_UI_META,
          };
        }
        if (name === "hiku_hint") {
          if (!TIERS.includes(args.difficulty)) throw {code: -32602, message: "difficulty must be easy, medium, hard or expert"};
          const b = await boardAfter(env, args.difficulty, moves, day);
          if (!b.n) return {content: [{type: "text", text: b.error}], isError: true};
          if (b.error) return {content: [{type: "text", text: b.error}], isError: true};
          return {content: [{type: "text", text: hintText(args.difficulty, b)}]};
        }
        if (name === "hiku_analyze") {
          if (!TIERS.includes(args.difficulty)) throw {code: -32602, message: "difficulty must be easy, medium, hard or expert"};
          const b = await boardAfter(env, args.difficulty, moves, day);
          if (!b.n) return {content: [{type: "text", text: b.error}], isError: true};
          if (b.error) return {content: [{type: "text", text: b.error}], isError: true};
          return {content: [{type: "text", text: analyseText(args.difficulty, b, typeof args.move === "string" ? args.move : null) +
            "\n\nThink it through with the player; share only as much as they want to know."}]};
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
  // A message is a few hundred bytes; a batch of more than 20, or a body over 64 kB, is not from a real client.
  if (+(request.headers.get("content-length") || 0) > 65536) return json({jsonrpc: "2.0", id: null, error: {code: -32600, message: "Request too large"}}, 413, cors);
  const text = await request.text();
  if (text.length > 65536) return json({jsonrpc: "2.0", id: null, error: {code: -32600, message: "Request too large"}}, 413, cors);
  // An empty POST is how a client probes the endpoint: answer as the reference MCP servers do, 406 unless it accepts both JSON and a stream.
  const accept = request.headers.get("accept") || "";
  if (!text.trim() && !(accept.includes("application/json") && accept.includes("text/event-stream"))) {
    return json({jsonrpc: "2.0", id: null, error: {code: -32000, message: "Not Acceptable: Client must accept both application/json and text/event-stream"}}, 406, cors);
  }
  let body;
  try { body = JSON.parse(text); } catch { return json({jsonrpc: "2.0", id: null, error: {code: -32700, message: "Parse error"}}, 400, cors); }
  if (Array.isArray(body) && (body.length === 0 || body.length > 20)) return json({jsonrpc: "2.0", id: null, error: {code: -32600, message: "Invalid batch"}}, 400, cors);
  const answers = (await Promise.all((Array.isArray(body) ? body : [body]).map(m => mcpHandle(m, env)))).filter(Boolean);
  if (!answers.length) return new Response(null, {status: 202, headers: cors});
  return json(Array.isArray(body) ? answers : answers[0], 200, {...cors, "cache-control": "no-store"});
}

// What the worker answers itself gets the same safety headers as the files (see _headers); the files keep their own.
const SAFETY = {
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

function safe(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SAFETY)) if (!headers.has(k)) headers.set(k, v);
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}

export default {
  async fetch(request, env) {
    return safe(await route(request, env));
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/api/daily") return daily(url, env);
  if (url.pathname === "/mcp") return mcp(request, env);
  if (url.pathname === "/.well-known/apple-app-site-association") return json(APP_SITE_ASSOCIATION, 200, {"cache-control": "public, max-age=3600"});
  if (url.pathname === "/.well-known/openai-apps-challenge") return new Response(OPENAI_APPS_CHALLENGE, {headers: {"content-type": "text/plain; charset=utf-8"}});
  if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) return home(request, url, env);
  return env.ASSETS.fetch(request);
}
