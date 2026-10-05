// J2 Plate — targets and portion optimizer. No DOM code here, so it can be tested in Node.
(function (root) {
  // Column order matches the Food sheet: Cals Fat-T Fat-S TFA Chol Sod Carb Fiber Sugar SugAdd Prot D Calc Iron Potas
  const KEYS = ["cal", "fat", "sfa", "tfa", "chol", "sod", "carb", "fib", "sug", "add", "pro", "vitd", "calc", "iron", "pot"];
  const LABELS = ["Calories", "Fat", "Sat fat", "Trans fat", "Cholesterol", "Sodium", "Carbs", "Fiber", "Sugar",
    "Added sugar", "Protein", "Vitamin D", "Calcium", "Iron", "Potassium"];
  const UNITS = ["kcal", "g", "g", "g", "mg", "mg", "g", "g", "g", "g", "g", "mcg", "mg", "mg", "mg"];
  // aim = hit it; max = stay under; min = reach at least
  const KIND = ["aim", "aim", "max", "max", "max", "max", "aim", "min", "max", "max", "min", "min", "min", "min", "min"];
  // how much each miss hurts (squared, relative to the target)
  const WEIGHT = [14, 3, 6, 0, 1.5, 3, 2, 3, 1, 5, 16, 0.2, 0.6, 0.8, 0.6];

  const PLAN_A = [2600, 80, 20, 0, 200, 2300, 330, 35, 60, 25, 140, 20, 1000, 14, 3400]; // weeks 1–2 and 9
  const PLAN_B = [2350, 72, 18, 0, 200, 2300, 280, 38, 55, 20, 145, 20, 1000, 14, 3400]; // weeks 3–8, 10–12

  function planWeek(dateISO, startISO) {
    const d = (Date.parse(dateISO) - Date.parse(startISO)) / 864e5;
    return Math.floor(d / 7) + 1;
  }
  function dailyTarget(dateISO, startISO) {
    const w = planWeek(dateISO, startISO);
    return (w === 1 || w === 2 || w === 9) ? PLAN_A.slice() : PLAN_B.slice();
  }

  const zero = () => KEYS.map(() => 0);
  function addInto(acc, n, q) { for (let i = 0; i < acc.length; i++) acc[i] += (n[i] || 0) * q; return acc; }
  function sumPlate(plate, items) {
    const t = zero();
    for (const p of plate) if (items[p.id]) addInto(t, items[p.id].n, p.qty);
    return t;
  }

  function cost(tot, tgt) {
    let c = 0;
    for (let i = 0; i < KEYS.length; i++) {
      const T = tgt[i], v = tot[i];
      if (KIND[i] === "max") {
        if (i === 3) { c += 4 * v; continue; }          // trans fat: any is bad
        if (T <= 0) { c += WEIGHT[i] * v / 10; continue; }
        if (v > T) c += WEIGHT[i] * ((v - T) / T) ** 2;
      } else if (KIND[i] === "min") {
        if (T > 0 && v < T) c += WEIGHT[i] * ((T - v) / T) ** 2;
        else if (i === 10 && T > 0) c += 0.5 * ((v - T) / T) ** 2; // a little protein overshoot is fine
      } else if (T > 0) {
        c += WEIGHT[i] * ((v - T) / T) ** 2;
      }
    }
    return c;
  }

  // Pick whole portions from `cands` (array of {id, n, cap, bias}) to land as close to `tgt` as possible.
  function optimize(cands, tgt, opts = {}) {
    const maxDistinct = opts.maxDistinct || 6;
    const qty = new Map();
    const tot = zero();
    const total = () => {
      let distinct = 0, servings = 0, bias = 0;
      for (const [id, q] of qty) if (q > 0) { distinct++; servings += q; bias += cands[idx[id]].bias * q; }
      return { distinct, servings, bias };
    };
    const idx = {}; cands.forEach((c, i) => { idx[c.id] = i; });
    const score = () => {
      const s = total();
      return cost(tot, tgt) + 0.04 * Math.max(0, s.distinct - 3) + 0.004 * s.servings + s.bias
        + (s.distinct > maxDistinct ? 1 : 0);
    };
    const apply = (c, d) => { qty.set(c.id, (qty.get(c.id) || 0) + d); addInto(tot, c.n, d); };
    let best = score();

    for (let iter = 0; iter < 200; iter++) {
      let move = null, moveScore = best;
      for (const c of cands) {
        const q = qty.get(c.id) || 0;
        if (q < c.cap) { apply(c, 1); const s = score(); if (s < moveScore - 1e-9) { moveScore = s; move = [[c, 1]]; } apply(c, -1); }
        if (q > 0) { apply(c, -1); const s = score(); if (s < moveScore - 1e-9) { moveScore = s; move = [[c, -1]]; } apply(c, 1); }
      }
      if (!move) {   // try swapping one portion of a chosen item for another item
        for (const a of cands) {
          if (!(qty.get(a.id) > 0)) continue;
          apply(a, -1);
          for (const b of cands) {
            if (b === a || (qty.get(b.id) || 0) >= b.cap) continue;
            apply(b, 1); const s = score(); if (s < moveScore - 1e-9) { moveScore = s; move = [[a, -1], [b, 1]]; } apply(b, -1);
          }
          apply(a, 1);
        }
      }
      if (!move) break;
      for (const [c, d] of move) apply(c, d);
      best = moveScore;
    }
    const plate = [];
    for (const c of cands) { const q = qty.get(c.id) || 0; if (q > 0) plate.push({ id: c.id, qty: q }); }
    return { plate, total: tot.slice(), score: best };
  }

  // Simple seeded random so "Swap" gives repeatable alternatives.
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  function candidates(menuEntries, items, opts) {
    const seen = new Set(), out = [];
    const r = rng(opts.seed || 1);
    for (const e of menuEntries) {
      const it = items[e.id];
      if (!it || seen.has(e.id)) continue;
      seen.add(e.id);
      const icons = it.icons || [];
      if (!icons.includes("veggie") && !icons.includes("vegan")) continue;
      if (opts.noEggs && icons.includes("eggs")) continue;
      if (opts.hidden && opts.hidden.has(e.id)) continue;
      if (!(it.n && it.n[0] > 0)) continue;
      const avoid = opts.avoid && opts.avoid.has(e.id) ? 0.05 : 0;
      out.push({ id: e.id, n: it.n, cap: it.n[0] < 60 ? 4 : 3, bias: (opts.seed > 1 ? r() * 0.06 : 0) + avoid });
    }
    return out;
  }

  // Split what's left of the day across the meals still to eat.
  function mealTargets(dayTarget, alreadyEaten, mealsLeft, shares) {
    const remaining = dayTarget.map((t, i) => Math.max(0, t - alreadyEaten[i]));
    const totalShare = mealsLeft.reduce((s, m) => s + (shares[m] || 0), 0) || 1;
    const out = {};
    for (const m of mealsLeft) out[m] = remaining.map(v => v * (shares[m] || 0) / totalShare);
    return out;
  }

  const api = { KEYS, LABELS, UNITS, KIND, PLAN_A, PLAN_B, planWeek, dailyTarget, sumPlate, addInto, zero,
    cost, optimize, candidates, mealTargets };
  if (typeof module !== "undefined") module.exports = api; else root.Planner = api;
})(this);
