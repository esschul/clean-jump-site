// Usage: node tools/school/test.mjs  prints the pool for the school's final test: for each lesson, fresh boards the
// lessons do not use (four traps of its kind and two safe moves), checked again with the solver and the engine.
import fs from "node:fs";
import {moved, solvable, trap} from "../../daily/explain.js";
const page = fs.readFileSync(new URL("../../skole/index.html", import.meta.url), "utf8");
const lessons = JSON.parse(page.slice(page.indexOf("/*LESSONS*/") + 11, page.indexOf("/*END*/")));
const KINDS = {alone: ["stranded"], meet: ["unreachable"], partner: ["shared"], order: ["wrongMoment", "needsSquare"], parity: ["oddGroup"], ahead: ["follow"]};
const COLS = "ABCDEFGH", sq = (n, i) => COLS[i % n] + (Math.floor(i / n) + 1);
const used = new Set(lessons.flatMap(l => [...l.steps, ...(l.extra || [])].map(s => s.cells.join())));
const pool = [];
for (const l of lessons) {
  if (!KINDS[l.id]) continue;
  const c = JSON.parse(fs.readFileSync(new URL(`${l.id}-candidates.json`, import.meta.url)));
  const size = b => b.n * 10 + b.cells.filter(Boolean).length;
  const fresh = list => list.filter(b => !used.has(b.cells.join())).sort((a, b) => size(a) - size(b) || Math.random() - .5);
  const check = (b, wantTrap) => {
    const {from, to} = b.move, ok = solvable(moved(b.cells, from, to), b.n, new Map(), 1e6);
    if (ok === null || ok === wantTrap) return false;
    return !wantTrap || KINDS[l.id].includes((trap(b.cells, b.n, {from, to, jumper: b.cells[from], target: b.cells[to]}) || {}).kind);
  };
  for (const [list, wantTrap, k] of [[c.predictTrap, true, 4], [c.predictSafe, false, 2]]) {
    let got = 0;
    for (const b of fresh(list)) {
      if (got >= k) break;
      if (used.has(b.cells.join()) || !check(b, wantTrap)) continue;
      used.add(b.cells.join()); got++;
      pool.push({n: b.n, cells: b.cells, move: [sq(b.n, b.move.from), sq(b.n, b.move.to)]});
    }
  }
}
console.log(JSON.stringify(pool));
