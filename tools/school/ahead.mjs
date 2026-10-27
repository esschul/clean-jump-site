// Usage: node tools/school/ahead.mjs [seconds]  (writes tools/school/ahead-candidates.json, not committed)
// Candidates for "Hva skjer etterpå?": traps that look safe right after the move (no number alone, none out of reach,
// no odd group: certificate() finds nothing) but where one number, followed through every way on, is never cleared.
// Kept only when the way to where it gets stuck can be played out on the board, jump by jump, as the page will.
import fs from "node:fs";
import {targets, moved, solvable, trap, certificate, followGraph, say} from "../../daily/explain.js";
import {wayToStuck} from "./way.mjs";

const seconds = Number(process.argv[2] || 180);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const out = {predictTrap: [], predictSafe: [], findTrap: []};
const t0 = Date.now();
while (Date.now() - t0 < seconds * 1000) {
  const n = Math.random() < .5 ? 4 : 5, count = rnd(5, n === 4 ? 8 : 9), cells = Array(n * n).fill(0);
  for (let k = 0; k < count;) { const i = rnd(0, n * n - 1); if (!cells[i]) { cells[i] = rnd(1, n === 4 ? 3 : 4); k++; } }
  if (solvable(cells, n, new Map(), 100_000) !== true) continue;
  const moves = [], seen = new Set();
  let unknown = false;
  for (let i = 0; i < cells.length && !unknown; i++) for (const t of targets(cells, n, i)) {
    const after = moved(cells, i, t), k = after.join(",");
    if (seen.has(k)) continue;
    seen.add(k);
    const ok = solvable(after, n, new Map(), 100_000);
    if (ok === null) { unknown = true; break; }
    let way = null, kind = ok ? "safe" : "other";
    if (!ok) {
      const e = trap(cells, n, {from: i, to: t, jumper: cells[i], target: cells[t]});
      if (e && e.kind === "follow" && !certificate(after, n)) {
        way = wayToStuck(after, n, e.focus[0], followGraph);
        if (way && way.length >= 1 && way.length <= 3) kind = "ahead";
        if (kind === "ahead") way = {steps: way, start: e.focus[0], head: say(e.headline, "nb")};
      }
    }
    moves.push({from: i, to: t, ok, kind, way});
  }
  if (unknown || moves.length < 3 || moves.length > 7) continue;
  const bad = moves.filter(m => !m.ok), ours = bad.filter(m => m.kind === "ahead");
  for (const m of ours) out.predictTrap.push({n, cells, move: m, choices: moves.length});
  if (ours.length) for (const m of moves.filter(m => m.ok)) out.predictSafe.push({n, cells, move: m, choices: moves.length});
  if (bad.length === 1 && ours.length === 1) out.findTrap.push({n, cells, trap: ours[0], choices: moves.length});
}
for (const k in out) console.log("ahead", k, out[k].length);
fs.writeFileSync(new URL("ahead-candidates.json", import.meta.url), JSON.stringify(out));
