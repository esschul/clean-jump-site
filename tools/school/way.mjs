// The way one number goes to where it gets stuck, as moves that can be played on the board one after another:
// [{from, to}], or null when the follow graph's way cannot be played out from this board as it stands. Shared by the
// candidate search and, copied, by the school page (keep the two the same).
import {targets, moved} from "../../daily/explain.js";

export function wayToStuck(cells, n, start, followGraph) {
  const graph = followGraph(cells, n, start);
  if (!graph) return null;
  // Depth first through the number's states, playing each step on a copy of the board, to the first state it can
  // never leave.
  const seen = new Set();
  function go(p, token, path) {
    const node = `${token},${p[token]}`;
    const out = graph.get(node);
    if (!out) return null;
    if (!out.size) return path;
    if (seen.has(node) || path.length > 4) return null;
    seen.add(node);
    for (const [to, step] of out) {
      const [t] = to.split(",").map(Number);
      const tries = step.jump ? [[token, t]] : [...step.who].map(w => [w, token]);
      for (const [a, z] of tries) {
        if (!targets(p, n, a).includes(z)) continue;
        const q = moved(p, a, z);
        if (`${z === token || a === token ? z : token},${q[a === token ? z : token]}` !== to) continue;
        const r = go(q, a === token ? z : token, [...path, {from: a, to: z}]);
        if (r) return r;
      }
    }
    seen.delete(node);
    return null;
  }
  return go(cells.slice(), start, []);
}
