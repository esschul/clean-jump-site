// Why a move made a Hiku board impossible to clear, in words a player can check on the board: a short headline, said
// first, and the reason behind it for those who ask. The same proofs, in the same order, as the iOS app's Explain.swift
// and the Android app's Explain.kt, and every one is a proof: none is ever said of a board that can be cleared.
//
// The words come out as the names of texts and what goes into them, and say() puts them into one of six languages
// from explain-texts.js, which tools/build_explain_texts.py writes from the iOS app's string catalog. A board is a
// flat array of n×n numbers, 0 for an empty square.

import {TEXTS} from "./explain-texts.js";

// ---- The rules

const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]];

/** The squares a number can land on: exactly its value away in a straight line, on another number. */
export function targets(cells, n, i) {
  const v = cells[i], r = Math.floor(i / n), c = i % n, out = [];
  if (!v) return out;
  for (const [dr, dc] of DIRS) {
    const rr = r + dr * v, cc = c + dc * v;
    if (rr >= 0 && rr < n && cc >= 0 && cc < n && cells[rr * n + cc] > 0) out.push(rr * n + cc);
  }
  return out;
}

/** The board after a number jumps: the difference stays where it landed. */
export function moved(cells, from, to) {
  const next = cells.slice();
  next[to] = Math.abs(cells[from] - cells[to]);
  next[from] = 0;
  return next;
}

export const squareName = (n, i) => String.fromCharCode(65 + i % n) + (Math.floor(i / n) + 1);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const key = cells => cells.join(",");

/** Numbers that share no row or column with each other never meet, so each such group is solved on its own. */
function groups(cells, n) {
  const parent = [...Array(2 * n).keys()];
  const find = x => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
  const occupied = [];
  cells.forEach((v, i) => { if (v) { occupied.push(i); const a = find(Math.floor(i / n)), b = find(n + i % n); if (a !== b) parent[a] = b; } });
  const by = new Map();
  for (const i of occupied) { const k = find(Math.floor(i / n)); if (!by.has(k)) by.set(k, []); by.get(k).push(i); }
  return [...by.values()];
}

/** true when the board can be cleared, false when it cannot, null when the search gave up past its budget. */
export function solvable(cells, n, memo = new Map(), budget = 2_000_000) {
  let left = budget;
  function search(p) {
    const k = key(p);
    if (memo.has(k)) return memo.get(k);
    if (p.every(v => v === 0)) return true;
    if (left <= 0) return null;
    left--;
    const parts = groups(p, n);
    if (parts.length > 1 || parts[0].length === 1) {
      // A lone number, or a group with an odd sum, settles it at once: a − b has the same parity as a + b.
      for (const part of parts) {
        if (part.length === 1 || part.reduce((sum, i) => sum + p[i], 0) % 2) { memo.set(k, false); return false; }
      }
      if (parts.length > 1) {
        let gaveUp = false;
        for (const part of parts.sort((a, b) => a.length - b.length)) {
          const q = new Array(p.length).fill(0);
          for (const i of part) q[i] = p[i];
          const r = search(q);
          if (r === false) { memo.set(k, false); return false; }
          if (r === null) gaveUp = true;
        }
        if (gaveUp) return null;
        memo.set(k, true);
        return true;
      }
    }
    let gaveUp = false;
    for (let i = 0; i < p.length; i++) for (const t of targets(p, n, i)) {
      const r = search(moved(p, i, t));
      if (r === true) { memo.set(k, true); return true; }
      if (r === null) gaveUp = true;
    }
    if (gaveUp) return null;
    memo.set(k, false);
    return false;
  }
  return search(cells);
}

// ---- Words

const phrase = (k, ...args) => ({key: k, args});
const count = value => ({count: value});
const plain = text => ({plain: text});
const cap = words => ({cap: words});
const anyOf = items => ({or: items});
const allOf = items => ({and: items});
const sentences = items => ({sentences: items});
const number = (value, square) => phrase("explain.number", count(value), plain(square));
const numberAt = (cells, n, i) => number(cells[i], squareName(n, i));

/** A text with its %@ and %lld filled in, numbered (%2$@) or in order, as in the iOS catalog. */
function fill(template, args) {
  let next = 0;
  return template.replace(/%(?:(\d+)\$)?(lld|@)/g, (_, at) => String(args[at ? +at - 1 : next++]));
}

/** Words as a string in [lang]: one of nb, en, sv, da, fi, de. */
export function say(words, lang) {
  const texts = TEXTS[lang] || TEXTS.en;
  const list = (items, word) => items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + ` ${word} ` + items[items.length - 1];
  const out = w => {
    if ("count" in w) return String(w.count);
    if ("plain" in w) return w.plain;
    if ("or" in w) return list(w.or.map(out), texts["list.or"]);
    if ("and" in w) return list(w.and.map(out), texts["list.and"]);
    if ("sentences" in w) return w.sentences.map(out).join(" ");
    if ("cap" in w) { const s = out(w.cap); return s.charAt(0).toLocaleUpperCase(lang) + s.slice(1); }
    return fill(texts[w.key], w.args.map(out));
  };
  return out(words);
}

// ---- What could ever meet

/** Every value each number could ever hold, and which pairs in line could ever meet. Squares only ever empty, never
 *  fill, and a value changes only when a number lands on it, so this lets in every meeting real play could make and
 *  maybe more: whatever it rules out can never happen. */
function couldMeet(cells, n) {
  const occupied = cells.map((v, i) => v ? i : -1).filter(i => i >= 0);
  const values = new Map(occupied.map(i => [i, new Set([cells[i]])]));
  const pairs = [];
  for (const a of occupied) for (const b of occupied) {
    if (b > a && (Math.floor(a / n) === Math.floor(b / n) || a % n === b % n)) {
      pairs.push({a, b, distance: Math.abs(Math.floor(a / n) - Math.floor(b / n)) + Math.abs(a % n - b % n)});
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const pair of pairs) for (const [x, y] of [[pair.a, pair.b], [pair.b, pair.a]]) {
      if (!values.get(x).has(pair.distance)) continue;
      for (const v of [...values.get(y)]) {
        const w = Math.abs(v - pair.distance);
        if (w > 0 && !values.get(y).has(w)) { values.get(y).add(w); changed = true; }
      }
    }
  }
  const links = pairs.filter(p => values.get(p.a).has(p.distance) || values.get(p.b).has(p.distance));
  return {occupied, values, pairs, links};
}

/** A number left alone, a number that can never be the right distance from any other, or a small group that can only
 *  meet itself with an odd sum. */
export function certificate(cells, n) {
  const meet = couldMeet(cells, n);
  if (!meet.occupied.length) return null;
  const name = i => numberAt(cells, n, i);
  const lone = meet.occupied.find(i => !meet.pairs.some(p => p.a === i || p.b === i));
  if (lone !== undefined) {
    return {kind: "stranded", cells, focus: [lone], headline: cap(phrase("explain.stranded", name(lone))), reason: phrase("explain.stranded.why")};
  }
  const alone = meet.occupied.find(i => !meet.links.some(p => p.a === i || p.b === i));
  if (alone !== undefined) {
    const mates = meet.pairs.filter(p => p.a === alone || p.b === alone).map(p => [p.a === alone ? p.b : p.a, p.distance]);
    // One pair is enough to follow; the headline already says the number is stuck.
    const [mate, d] = mates[0];
    const pair = d === 1 ? phrase("explain.pair.next", name(alone), name(mate)) : phrase("explain.pair", name(alone), name(mate), count(d), count(d));
    const still = i => cap(phrase("explain.nothingLands", name(i), count(cells[i])));
    const first = changes(cells, n, meet, alone), second = changes(cells, n, meet, mate);
    const landing = !first && !second ? phrase("explain.nothingLandsEither") : sentences([first || still(alone), second || still(mate)]);
    return {kind: "unreachable", cells, focus: [alone, ...mates.map(m => m[0])], headline: cap(phrase("explain.cannotClear", name(alone))),
      reason: sentences([cap(pair), landing, phrase("explain.neither", count(d))])};
  }
  // A small group only: a reader can follow three numbers, not five.
  const parent = new Map(meet.occupied.map(i => [i, i]));
  const find = x => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  for (const link of meet.links) parent.set(find(link.a), find(link.b));
  const byRoot = new Map();
  for (const i of meet.occupied) { const r = find(i); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(i); }
  if (byRoot.size > 1) {
    const odd = [...byRoot.values()].filter(g => g.reduce((s, i) => s + cells[i], 0) % 2 === 1 && g.length <= 3).sort((a, b) => a.length - b.length)[0];
    if (odd) {
      const sorted = odd.slice().sort((a, b) => a - b);
      return {kind: "oddGroup", cells, focus: sorted, headline: cap(phrase("explain.oddGroup", allOf(sorted.map(name)))),
        reason: phrase("explain.oddGroup.why", count(odd.reduce((s, i) => s + cells[i], 0)))};
    }
  }
  return null;
}

/** What could land on a number, and what each landing would make of it; null when nothing can. */
function changes(cells, n, meet, index) {
  const landers = meet.pairs.filter(p => p.a === index || p.b === index).map(p => [p.a === index ? p.b : p.a, p.distance])
    .filter(([lander, d]) => meet.values.get(lander).has(d));
  if (!landers.length) return null;
  return sentences(landers.map(([lander, d]) => {
    const made = [...new Set([...meet.values.get(index)].map(v => Math.abs(v - d)))].filter(v => v > 0).sort((a, b) => a - b);
    // The lander has to be the distance itself to land; if it is something else now, it has to become that first.
    const who = cells[lander] === d ? numberAt(cells, n, lander) : phrase("explain.numberOnceItIs", numberAt(cells, n, lander), count(d));
    const whom = numberAt(cells, n, index);
    return cap(made.length ? phrase("explain.landsMakes", who, whom, anyOf(made.map(count))) : phrase("explain.landsVanish", who, whom));
  }));
}

// ---- Right move, wrong moment

/** Every way to clear `before`, as lists of moves, or null when there are too many to look at them all. */
function solutionsOf(before, n, memo) {
  const solutions = [], line = [];
  let nodes = 0;
  (function walk(p) {
    if (solutions.length > 2000 || nodes > 20_000) return;
    nodes++;
    if (p.every(v => v === 0)) { solutions.push(line.slice()); return; }
    for (let i = 0; i < p.length; i++) for (const t of targets(p, n, i)) {
      const next = moved(p, i, t);
      if (solvable(next, n, memo, 400_000) !== true) continue;
      line.push({from: i, to: t, jumper: p[i], target: p[t]}); walk(next); line.pop();
    }
  })(before);
  return !solutions.length || solutions.length > 2000 || nodes > 20_000 ? null : solutions;
}

/** The move is in every way to clear the board, but another number has to land on the same square first, while it
 *  is still what it is now. Found from every solution of the position before the move, so it is always true. */
function wrongMoment(before, n, move, solutions) {
  const at = solutions.map(s => s.findIndex(m => m.from === move.from && m.to === move.to));
  if (at.some(k => k < 0)) return null;
  const firsts = solutions.map((s, k) => s.slice(0, at[k]).filter(m => m.to === move.to));
  const first = firsts[0].map(m => m.from).find(i => firsts.every(f => f.some(m => m.from === i)));
  if (first === undefined) return null;
  // The number may have changed before it jumps, and so may the square it lands on: they are told as they are then,
  // and only when every way to clear the board agrees on both.
  const then = firsts.map(f => f.find(m => m.from === first));
  if (!then.every(m => m.jumper === then[0].jumper && m.target === then[0].target)) return null;
  const square = plain(squareName(n, move.to)), now = Math.abs(move.jumper - move.target);
  const lander = numberAt(before, n, first), mover = numberAt(before, n, move.from);
  return {kind: "wrongMoment", cells: before, focus: [first, move.to],
    headline: cap(now === 0 ? phrase("explain.dependsOn.gone", lander, square) : phrase("explain.dependsOn", lander, square, count(now))),
    reason: then[0].jumper === before[first]
      ? phrase("explain.dependsOn.why", lander, square, count(then[0].target), mover)
      : phrase("explain.dependsOn.whyBecomes", lander, count(then[0].jumper), square, count(then[0].target), mover)};
}

/** The move emptied a square another number needs: in every way to clear the board, that number jumps onto the square
 *  or the number there lands on it, and the square is empty now. Found from every solution, so it is always true. */
function needsSquare(before, n, move, solutions) {
  const after = moved(before, move.from, move.to);
  for (const square of [move.to, move.from]) {
    if (after[square]) continue;
    const jumps = x => solutions.every(s => s.some(m => m.from === x && m.to === square));
    const lands = x => solutions.every(s => s.some(m => m.from === square && m.to === x));
    const either = x => solutions.every(s => s.some(m => (m.from === x && m.to === square) || (m.from === square && m.to === x)));
    const x = before.findIndex((v, i) => v && i !== move.from && i !== move.to && either(i));
    if (x < 0) continue;
    const name = numberAt(before, n, x), where = plain(squareName(n, square));
    return {kind: "needsSquare", cells: before, focus: [x, square],
      headline: cap(phrase("explain.dependsOn.gone", name, where)),
      reason: phrase(jumps(x) ? "explain.needs.jumps" : lands(x) ? "explain.needs.lands" : "explain.needs.either", name, where)};
  }
  return null;
}

// ---- Follow one number

/** Every way one number can go, over every position that can be reached: for each "square,value" it can have, the
 *  steps out of it. Null when the number is cleared somewhere, so it is no proof, or the search is too large. */
function followGraph(cells, n, start, limit = 60_000) {
  const edges = new Map(), seen = new Set([key(cells) + "|" + start]), queue = [[cells, start]];
  while (queue.length) {
    const [p, token] = queue.pop(), here = `${token},${p[token]}`;
    if (!edges.has(here)) edges.set(here, new Map());
    const out = edges.get(here);
    for (let i = 0; i < p.length; i++) for (const t of targets(p, n, i)) {
      const q = moved(p, i, t);
      let next = token;
      if (i === token || t === token) {
        if (!q[t]) return null;
        const to = `${t},${q[t]}`;
        if (i === token) { next = t; if (!out.has(to)) out.set(to, {jump: true, who: new Set()}); }
        else { if (!out.has(to)) out.set(to, {jump: false, who: new Set()}); out.get(to).who.add(i); }
      }
      const state = key(q) + "|" + next;
      if (seen.has(state)) continue;
      if (seen.size >= limit) return null;
      seen.add(state);
      queue.push([q, next]);
    }
  }
  return edges;
}

/** One number followed through every way the game can go on: what can land on it, where it can jump, and what it
 *  becomes, until it is stuck. Only when that number is never cleared in any position that can be reached; told step
 *  by step when that is at most six values on at most eight steps, else with `summary` as what it can become and where
 *  it can go. Every sentence is what that search saw and nothing more. */
export function follow(cells, n, summary = false) {
  let best = null;
  cells.forEach((v, start) => {
    if (!v) return;
    const graph = followGraph(cells, n, start);
    if (!graph) return;
    const steps = [...graph.values()].reduce((s, m) => s + m.size, 0);
    if (!summary && (graph.size > 6 || steps > 8 || [...graph.values()].some(m => [...m.values()].some(e => e.who.size > 3)))) return;
    if (!best || steps < best.steps || (steps === best.steps && graph.size < best.graph.size)) best = {start, graph, steps};
  });
  if (!best) return null;
  const {start, graph} = best;
  const at = k => k.split(",").map(Number);
  const called = k => { const [square, value] = at(k); return number(value, squareName(n, square)); };
  const first = `${start},${cells[start]}`;
  if (summary) {
    // Too much happens to it to tell step by step: what it can become and where it can go, and that it never goes.
    const nodes = [...graph.keys()].map(at);
    const values = [...new Set(nodes.map(([, v]) => v))].filter(v => v !== cells[start]).sort((a, b) => a - b).map(count);
    const squares = [...new Set(nodes.map(([s]) => s))].filter(s => s !== start).sort((a, b) => a - b);
    const where = anyOf(squares.map(s => plain(squareName(n, s))));
    const reason = !squares.length ? phrase("explain.follow.summaryHere", called(first), anyOf(values))
      : !values.length ? phrase("explain.follow.summaryMoves", called(first), where)
      : phrase("explain.follow.summary", called(first), anyOf(values), where);
    return {kind: "follow", cells, focus: [start, ...squares], headline: cap(phrase("explain.follow", called(first))), reason: cap(reason)};
  }
  // Each value it can have, in the order it can come to have them.
  const order = [first];
  for (let k = 0; k < order.length; k++) {
    const next = [...graph.get(order[k]).keys()].sort((a, b) => at(a)[0] - at(b)[0] || at(a)[1] - at(b)[1]);
    for (const to of next) if (!order.includes(to)) order.push(to);
  }
  const told = [];
  for (const node of order) {
    const out = [...graph.get(node).entries()];
    if (!out.length) continue;
    const [square] = at(node);
    const distance = i => Math.abs(Math.floor(i / n) - Math.floor(square / n)) + Math.abs(i % n - square % n);
    // Jumps to the same square that leave different numbers, by what was there, are told as one.
    const jumps = new Map();
    for (const [to, step] of out) if (step.jump) { const [t, w] = at(to); jumps.set(t, [...(jumps.get(t) || []), w]); }
    const jumped = [...jumps.keys()].sort((a, b) => a - b)
      .map(t => phrase("explain.follow.jumpTo", plain(squareName(n, t)), anyOf(jumps.get(t).sort((a, b) => a - b).map(count))));
    const landed = out.filter(([, step]) => !step.jump).sort((a, b) => at(b[0])[1] - at(a[0])[1]).map(([to, step]) => {
      const from = anyOf([...step.who].sort((a, b) => a - b).map(i => phrase("explain.follow.from", count(distance(i)), plain(squareName(n, i)))));
      return to === node ? phrase("explain.follow.leaves", from, count(at(to)[1])) : phrase("explain.follow.makes", from, count(at(to)[1]));
    });
    told.push(phrase("explain.follow.all", called(node), anyOf([...jumped, ...landed])));
  }
  const stuck = order.filter(k => !graph.get(k).size);
  if (stuck.length === 1) told.push(cap(phrase("explain.follow.stuck", called(stuck[0]))));
  if (stuck.length > 1) told.push(cap(phrase("explain.follow.stuckAll", allOf(stuck.map(called)))));
  const focus = [start];
  for (const node of order) for (const [to, step] of graph.get(node)) {
    for (const s of step.jump ? [at(to)[0]] : [...step.who].sort((a, b) => a - b)) if (!focus.includes(s)) focus.push(s);
  }
  const neverJumps = ![...graph.get(first).values()].some(e => e.jump);
  return {kind: "follow", cells, focus, headline: cap(phrase(neverJumps ? "explain.follow.cannotJump" : "explain.follow", called(first))),
    reason: sentences(told)};
}

// ---- Two that can never both go

/** Two numbers that can never both disappear, found by following every number through every position that can be
 *  reached: where each one is (it goes on as what it leaves when it jumps, and two that land together go on as one)
 *  and which numbers it is with when it vanishes. Told as "both need the same number" when every way each of them can
 *  vanish takes that one number with it, which can only happen once; with `plain`, else as "never both". */
export function rivals(cells, n, plainToo = false, limit = 200_000) {
  const occupied = cells.map((v, i) => v ? i : -1).filter(i => i >= 0), k = occupied.length;
  const seen = new Set([key(cells) + "|" + occupied.join(",")]), queue = [[cells, occupied.slice()]];
  const both = new Set(), partners = occupied.map(() => []);
  while (queue.length) {
    const [p, where] = queue.pop();
    const gone = [];
    where.forEach((s, j) => { if (s < 0) gone.push(j); });
    for (let x = 0; x < gone.length; x++) for (let y = x + 1; y < gone.length; y++) both.add(gone[x] * 64 + gone[y]);
    for (let i = 0; i < p.length; i++) for (const t of targets(p, n, i)) {
      const q = moved(p, i, t);
      if (!q[t]) {
        const movers = [], hit = [];
        where.forEach((s, j) => { if (s === i) movers.push(j); if (s === t) hit.push(j); });
        for (const j of movers) partners[j].push(hit);
        for (const j of hit) partners[j].push(movers);
      }
      const next = where.map(s => s === i ? (q[t] ? t : -1) : s === t && !q[t] ? -1 : s);
      const state = key(q) + "|" + next.join(",");
      if (seen.has(state)) continue;
      if (seen.size >= limit) return null;
      seen.add(state);
      queue.push([q, next]);
    }
  }
  const always = j => partners[j].slice(1).reduce((acc, g) => acc.filter(c => g.includes(c)), partners[j][0].slice());
  const ways = j => new Set(partners[j].map(g => g.join("+"))).size;
  let found = null, bestScore = Infinity;
  for (let x = 0; x < k; x++) for (let y = x + 1; y < k; y++) {
    if (both.has(x * 64 + y) || !partners[x].length || !partners[y].length) continue;
    const shared = always(x).filter(c => always(y).includes(c));
    const score = (shared.length ? 0 : 100) + ways(x) + ways(y);
    if (score < bestScore) { bestScore = score; found = {x, y, c: shared[0]}; }
  }
  if (!found) return null;
  const {x, y, c} = found, name = j => numberAt(cells, n, occupied[j]);
  if (c !== undefined) {
    return {kind: "shared", cells, focus: [occupied[c], occupied[x], occupied[y]],
      headline: cap(phrase("explain.shared", name(x), name(y), name(c))), reason: cap(phrase("explain.shared.why", name(x), name(y), name(c)))};
  }
  if (!plainToo) return null;
  return {kind: "rivals", cells, focus: [occupied[x], occupied[y]],
    headline: cap(phrase("explain.rivals", name(x), name(y))), reason: phrase("explain.rivals.why")};
}

// ---- Always left

/** A number no order of play can ever clear, found by trying every way on, up to a limit. */
export function alwaysLeft(cells, n, limit = 60_000) {
  const occupied = cells.map((v, i) => v ? i : -1).filter(i => i >= 0);
  const cleared = new Set(), seen = new Set([key(cells)]), queue = [cells];
  while (queue.length) {
    const p = queue.pop();
    for (const i of occupied) if (!p[i]) cleared.add(i);
    if (cleared.size === occupied.length) return null;
    for (let i = 0; i < p.length; i++) for (const t of targets(p, n, i)) {
      const q = moved(p, i, t), k = key(q);
      if (seen.has(k)) continue;
      if (seen.size >= limit) return null;
      seen.add(k);
      queue.push(q);
    }
  }
  const mates = i => occupied.filter(j => j !== i && (Math.floor(j / n) === Math.floor(i / n) || j % n === i % n)).length;
  const left = occupied.filter(i => !cleared.has(i)).sort((a, b) => mates(a) - mates(b))[0];
  if (left === undefined) return null;
  return {kind: "alwaysLeft", cells, focus: [left], headline: cap(phrase("explain.alwaysLeft", numberAt(cells, n, left))),
    reason: phrase("explain.alwaysLeft.why")};
}

// ---- The trap

/** The explanation for a move from `before`, or null when the move is safe or no proof is found in time. */
export function trap(before, n, move) {
  if (!targets(before, n, move.from).includes(move.to)) return null;
  const after = moved(before, move.from, move.to), memo = new Map();
  if (solvable(after, n, memo, 2_000_000) !== false) return null;
  const plainOne = certificate(after, n);
  if (plainOne && plainOne.kind === "stranded") return plainOne;
  const solutions = solutionsOf(before, n, memo);
  return (solutions && (wrongMoment(before, n, move, solutions) || needsSquare(before, n, move, solutions)))
    || plainOne || follow(after, n) || rivals(after, n)
    || follow(after, n, true) || rivals(after, n, true) || alwaysLeft(after, n);
}

/** The move that made the board impossible to clear, from the boards played through, oldest first: the board before
 *  the first one that can no longer be cleared, and the move between them. Null when none is found in time. */
export function wrongMove(positions, n) {
  const memo = new Map();
  for (let k = 1; k < positions.length; k++) {
    const r = solvable(positions[k], n, memo, 2_000_000);
    if (r === true) continue;
    if (r === null) return null;
    const before = positions[k - 1];
    for (let i = 0; i < before.length; i++) for (const t of targets(before, n, i)) {
      if (same(moved(before, i, t), positions[k])) return {before, move: {from: i, to: t, jumper: before[i], target: before[t]}};
    }
    return null;
  }
  return null;
}

/** Why a position can no longer be cleared, with no move to blame: the proofs that look at the position alone. */
export function lost(cells, n) {
  return certificate(cells, n) || follow(cells, n) || rivals(cells, n) || follow(cells, n, true) || rivals(cells, n, true) || alwaysLeft(cells, n);
}

/** Why the board went wrong, from the boards played through: the explanation, or null when there is no short one. */
export function why(positions, n) {
  const found = wrongMove(positions, n);
  return found ? trap(found.before, n, found.move) : null;
}
