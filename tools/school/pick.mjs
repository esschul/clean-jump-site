// Usage: node tools/school/pick.mjs <lesson>  prints a lesson's steps from tools/school/<lesson>-candidates.json:
// an example and a predicted trap from the shortest explanations, a safe move to predict, find the trap and find the
// safe move, on the smallest boards, each board used once. The output goes into skole/index.html by hand, to be read.
import fs from "node:fs";
const lesson = process.argv[2];
const c = JSON.parse(fs.readFileSync(new URL(`${lesson}-candidates.json`, import.meta.url)));
const COLS = "ABCDEFGH", sq = (n, i) => COLS[i % n] + (Math.floor(i / n) + 1);
const size = b => b.n * 10 + b.cells.filter(Boolean).length;
const used = new Set();
const take = (list, score) => {
  const best = list.filter(b => !used.has(b.cells.join())).sort((a, b) => score(a) - score(b))[0];
  if (best) used.add(best.cells.join());
  return best;
};
const words = b => (b.move || b.trap).words;
const steps = [];
// The example shows the lesson's first kind, with its steps when it has them; "too early" is the heart of "order".
const FIRST = {order: "wrongMoment"};
const first = c.predictTrap.filter(b => !FIRST[lesson] || (b.move.kind === FIRST[lesson] && b.move.steps > 0));
const example = take(first, b => size(b) * 20 + words(b));
if (example) steps.push({type: "example", n: example.n, cells: example.cells, move: [sq(example.n, example.move.from), sq(example.n, example.move.to)]});
const trap = take(c.predictTrap, b => size(b) * 20 + words(b));
const safe = take(c.predictSafe, b => size(b) - b.bad * 3);
for (const p of [trap, safe].filter(Boolean)) steps.push({type: "predict", n: p.n, cells: p.cells, move: [sq(p.n, p.move.from), sq(p.n, p.move.to)]});
const find = take(c.findTrap, b => size(b) * 20 + words(b));
if (find) steps.push({type: "findTrap", n: find.n, cells: find.cells});
const safeOne = take(c.findSafe, b => size(b) - b.choices * 2);
if (safeOne) steps.push({type: "findSafe", n: safeOne.n, cells: safeOne.cells});
console.log(JSON.stringify(steps));
