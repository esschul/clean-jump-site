// Usage: node tools/school/extra.mjs  prints, for each lesson, spare predictions for "Prøv en lignende" after a wrong
// answer: two traps of the lesson's kind and one safe move, on boards the page does not use yet, checked again here.
import fs from "node:fs";
import {moved, solvable, trap} from "../../daily/explain.js";
const page = fs.readFileSync(new URL("../../skole/index.html", import.meta.url), "utf8");
const lessons = JSON.parse(page.slice(page.indexOf("/*LESSONS*/") + 11, page.indexOf("/*END*/")));
const KINDS = {alone: ["stranded"], meet: ["unreachable"], partner: ["shared"], order: ["wrongMoment", "needsSquare"], parity: ["oddGroup"]};
const FILE = {alone: "alone"};
const COLS = "ABCDEFGH", sq = (n, i) => COLS[i % n] + (Math.floor(i / n) + 1);
const out = {};
for (const l of lessons) {
  const c = JSON.parse(fs.readFileSync(new URL(`${FILE[l.id] || l.id}-candidates.json`, import.meta.url)));
  const used = new Set(l.steps.map(s => s.cells.join()));
  const size = b => b.n * 10 + b.cells.filter(Boolean).length;
  const fresh = list => list.filter(b => !used.has(b.cells.join())).sort((a, b) => size(a) - size(b) || Math.random() - .5);
  const check = (b, wantTrap) => {
    const {from, to} = b.move, after = moved(b.cells, from, to), ok = solvable(after, b.n, new Map(), 1e6);
    if (ok === null || ok === wantTrap) return false;
    return !wantTrap || KINDS[l.id].includes((trap(b.cells, b.n, {from, to, jumper: b.cells[from], target: b.cells[to]}) || {}).kind);
  };
  const pick = (list, wantTrap, k) => {
    const got = [];
    for (const b of fresh(list)) { if (got.length >= k) break; if (used.has(b.cells.join()) || !check(b, wantTrap)) continue; used.add(b.cells.join()); got.push(b); }
    return got;
  };
  const steps = [...pick(c.predictTrap, true, 2), ...pick(c.predictSafe, false, 1)];
  out[l.id] = steps.map(b => ({type: "predict", n: b.n, cells: b.cells, move: [sq(b.n, b.move.from), sq(b.n, b.move.to)]}));
}
console.log(JSON.stringify(out));
