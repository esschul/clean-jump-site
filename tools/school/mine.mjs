// Usage: node tools/school/mine.mjs <lesson> [seconds]  (writes tools/school/<lesson>-candidates.json, not committed)
// Candidates for a school lesson: small random boards, every legal move judged by the solver, and the losing ones
// explained by the engine. A lesson is the kinds of explanation it teaches.
import fs from "node:fs";
import {targets, moved, solvable, trap, say} from "../../daily/explain.js";

const LESSONS = {
  meet: ["unreachable"],
  partner: ["shared"],
  order: ["wrongMoment", "needsSquare"],
  parity: ["oddGroup"],
};
// An odd group is rarely the plainest reason on a small board, so that lesson looks at larger ones.
const BIG = {parity: true};
const lesson = process.argv[2], kinds = LESSONS[lesson], seconds = Number(process.argv[3] || 120);
if (!kinds) throw new Error(`lesson is one of ${Object.keys(LESSONS)}`);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const out = {predictTrap: [], predictSafe: [], findTrap: [], findSafe: []};
const t0 = Date.now();
while (Date.now() - t0 < seconds * 1000) {
  const n = BIG[lesson] ? rnd(5, 6) : Math.random() < .5 ? 4 : 5, count = BIG[lesson] ? rnd(6, 10) : rnd(4, n === 4 ? 7 : 8), cells = Array(n * n).fill(0);
  for (let k = 0; k < count;) { const i = rnd(0, n * n - 1); if (!cells[i]) { cells[i] = rnd(1, n === 4 ? 3 : 4); k++; } }
  if (solvable(cells, n, new Map(), 100_000) !== true) continue;
  const moves = [], seen = new Set();
  let unknown = false;
  for (let i = 0; i < cells.length && !unknown; i++) for (const t of targets(cells, n, i)) {
    const after = moved(cells, i, t), key = after.join(",");
    // Two equal numbers leave the same board whichever jumps: one choice, not two.
    if (seen.has(key)) continue;
    seen.add(key);
    const ok = solvable(after, n, new Map(), 100_000);
    if (ok === null) { unknown = true; break; }
    const e = ok ? null : trap(cells, n, {from: i, to: t, jumper: cells[i], target: cells[t]});
    moves.push({from: i, to: t, ok, kind: e ? e.kind : ok ? "safe" : "unexplained", focus: e ? e.focus : [],
      steps: e && e.steps ? e.steps.length : 0, words: e ? say(e.headline, "nb").length + say(e.reason, "nb").length : 0});
  }
  if (unknown || moves.length < 3 || moves.length > (BIG[lesson] ? 10 : 7)) continue;
  const bad = moves.filter(m => !m.ok), good = moves.filter(m => m.ok), ours = bad.filter(m => kinds.includes(m.kind));
  // Short enough to read: one explanation at a time.
  const short = m => m.words < 480;
  for (const m of ours) if (short(m)) out.predictTrap.push({n, cells, move: m, choices: moves.length, bad: bad.length});
  if (ours.length) for (const m of good) out.predictSafe.push({n, cells, move: m, choices: moves.length, bad: bad.length});
  if (bad.length === 1 && ours.length === 1 && short(ours[0])) out.findTrap.push({n, cells, trap: ours[0], choices: moves.length});
  if (good.length === 1 && bad.length >= 2 && bad.every(m => kinds.includes(m.kind) && short(m))) out.findSafe.push({n, cells, safe: good[0], choices: moves.length});
}
for (const k in out) console.log(lesson, k, out[k].length);
fs.writeFileSync(new URL(`${lesson}-candidates.json`, import.meta.url), JSON.stringify(out));
