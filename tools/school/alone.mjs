// Usage: node tools/school/alone.mjs  (runs 90 s, writes tools/school/alone-candidates.json, which is not committed)
// Candidates for the lesson "Hvilket tall blir stående alene?": every legal move of small random boards, judged by the solver alone.
import {targets, moved, solvable, certificate} from '../../daily/explain.js';
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const inLine = (n, a, b) => Math.floor(a / n) === Math.floor(b / n) || a % n === b % n;
const lone = (cells, n) => cells.map((v, i) => v && !cells.some((w, j) => w && j !== i && inLine(n, i, j)) ? i : -1).filter(i => i >= 0);
const out = {predictTrap: [], predictSafe: [], findTrap: [], findSafe: []};
const t0 = Date.now();
while (Date.now() - t0 < 90_000) {
  const n = Math.random() < .6 ? 4 : 5, count = rnd(4, 7), cells = Array(n * n).fill(0);
  for (let k = 0; k < count;) { const i = rnd(0, n * n - 1); if (!cells[i]) { cells[i] = rnd(1, 3); k++; } }
  if (lone(cells, n).length || solvable(cells, n, new Map(), 100_000) !== true) continue;
  const moves = []; let unknown = false;
  const seen = new Set();
  for (let i = 0; i < cells.length; i++) for (const t of targets(cells, n, i)) {
    const after = moved(cells, i, t), key = after.join(",");
    // Two equal numbers leave the same board whichever jumps: one choice, not two.
    if (seen.has(key)) continue; seen.add(key);
    const ok = solvable(after, n, new Map(), 100_000);
    if (ok === null) { unknown = true; break; }
    moves.push({from: i, to: t, ok, alone: lone(after, n)});
  }
  if (unknown || moves.length < 3 || moves.length > 6) continue;
  const bad = moves.filter(m => !m.ok), good = moves.filter(m => m.ok);
  const plainBad = bad.filter(m => m.alone.length === 1);
  // A move that strands one number, the one that is not the mover itself: the move took its last partner away.
  for (const m of plainBad) if (m.alone[0] !== m.to) out.predictTrap.push({n, cells, move: m, choices: moves.length});
  // A safe move after which every number still has someone in line.
  for (const m of good) if (!m.alone.length) out.predictSafe.push({n, cells, move: m, choices: moves.length});
  if (bad.length === 1 && plainBad.length === 1) out.findTrap.push({n, cells, trap: bad[0], choices: moves.length});
  if (good.length === 1 && bad.every(m => m.alone.length >= 1)) out.findSafe.push({n, cells, safe: good[0], choices: moves.length});
}
for (const k in out) console.log(k, out[k].length);
const fs = await import('node:fs');
fs.writeFileSync(new URL('alone-candidates.json', import.meta.url), JSON.stringify(out));
