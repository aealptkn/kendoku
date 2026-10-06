// engine.js — Python KenKenEngine sınıfının JavaScript karşılığı
(function (global) {
  'use strict';

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function weightedChoice(choices, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < choices.length; i++) {
      if (r < weights[i]) return choices[i];
      r -= weights[i];
    }
    return choices[choices.length - 1];
  }

  function randomChoiceArray(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function popcount(x) {
    let c = 0;
    while (x) { x &= x - 1; c++; }
    return c;
  }

  function bitToValue(bit) {
    let v = 1;
    while (bit > 1) { bit >>= 1; v++; }
    return v;
  }

  // ---------------- Latin kare üretimi ----------------
  function generateLatinSquare(n) {
    const base = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) row.push((i + j) % n);
      base.push(row);
    }
    const rows = shuffle([...Array(n).keys()]);
    const cols = shuffle([...Array(n).keys()]);
    const symbols = shuffle([...Array(n).keys()]);
    const grid = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const val0 = base[rows[r]][cols[c]];
        grid[r][c] = symbols[val0] + 1;
      }
    }
    return grid;
  }

  // ---------------- Kafes ipucu hesaplama ----------------
  function computeCageClue(values) {
    if (values.length === 1) return { op: "", target: values[0] };

    if (values.length === 2) {
      const [a, b] = values;
      const options = [["+", a + b], ["×", a * b]];
      if (a !== b) options.push(["-", Math.abs(a - b)]);
      const hi = Math.max(a, b), lo = Math.min(a, b);
      if (lo !== 0 && hi % lo === 0) options.push(["÷", hi / lo]);
      const choice = randomChoiceArray(options);
      return { op: choice[0], target: choice[1] };
    }

    const addTarget = values.reduce((a, b) => a + b, 0);
    const mulTarget = values.reduce((a, b) => a * b, 1);
    const choice = randomChoiceArray([["+", addTarget], ["×", mulTarget]]);
    return { op: choice[0], target: choice[1] };
  }

  function cageSizeDistribution(n) {
    if (n <= 5) return { choices: [1, 2, 3, 4], weights: [6, 42, 34, 18] };
    if (n <= 7) return { choices: [1, 2, 3, 4], weights: [8, 48, 34, 10] };
    return { choices: [1, 2, 3, 4], weights: [10, 54, 32, 4] };
  }

  function key(r, c) { return r * 100 + c; }
  function unkey(k) { return [Math.floor(k / 100), k % 100]; }

  // ---------------- Kafes üretimi (rastgele büyüyen bölgeler) ----------------
  function generateCages(solution, n) {
    const unassigned = new Set();
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        unassigned.add(key(r, c));

    const cages = [];
    const { choices, weights } = cageSizeDistribution(n);

    while (unassigned.size > 0) {
      const arr = Array.from(unassigned);
      const start = randomChoiceArray(arr);
      const maxPossible = unassigned.size;
      let size = weightedChoice(choices, weights);
      size = Math.min(size, maxPossible);

      const cageCells = [start];
      unassigned.delete(start);
      let frontier = [start];

      while (cageCells.length < size) {
        shuffle(frontier);
        let grown = false;
        for (const cell of frontier) {
          const [r, c] = unkey(cell);
          const neighbors = shuffle([
            key(r - 1, c), key(r + 1, c), key(r, c - 1), key(r, c + 1)
          ]);
          for (const nb of neighbors) {
            if (unassigned.has(nb)) {
              cageCells.push(nb);
              unassigned.delete(nb);
              frontier.push(nb);
              grown = true;
              break;
            }
          }
          if (grown) break;
        }
        if (!grown) break;
      }

      const cellsRC = cageCells.map(unkey);
      const values = cellsRC.map(([r, c]) => solution[r][c]);
      const { op, target } = computeCageClue(values);
      cages.push({ cells: cellsRC, op, target });
    }

    return cages;
  }

  // ---------------- Kafes kontrolü ----------------
  function checkCageComplete(cage, vals) {
    const { op, target } = cage;
    if (op === "") return vals[0] === target;
    if (op === "+") return vals.reduce((a, b) => a + b, 0) === target;
    if (op === "×") return vals.reduce((a, b) => a * b, 1) === target;
    if (op === "-") return Math.abs(vals[0] - vals[1]) === target;
    if (op === "÷") {
      const [a, b] = vals;
      const hi = Math.max(a, b), lo = Math.min(a, b);
      return lo !== 0 && hi % lo === 0 && (hi / lo) === target;
    }
    return false;
  }

  function checkCagePartialOk(cage, filledVals, n) {
    if (filledVals.length === 0) return true;
    const { op, target, cells } = cage;
    const size = cells.length;
    const remaining = size - filledVals.length;

    if (op === "+" || op === "") {
      const current = filledVals.reduce((a, b) => a + b, 0);
      if (remaining === 0) return current === target;
      const minP = current + remaining * 1;
      const maxP = current + remaining * n;
      return minP <= target && target <= maxP;
    }

    if (op === "×") {
      const current = filledVals.reduce((a, b) => a * b, 1);
      if (remaining === 0) return current === target;
      const minP = current;
      const maxP = current * Math.pow(n, remaining);
      return minP <= target && target <= maxP;
    }

    if (op === "-") {
      if (filledVals.length === 1) {
        const v = filledVals[0];
        const opt1 = v + target;
        const opt2 = v - target;
        return (opt1 >= 1 && opt1 <= n) || (opt2 >= 1 && opt2 <= n);
      }
      return true;
    }

    if (op === "÷") {
      if (filledVals.length === 1) {
        const v = filledVals[0];
        const opt1 = v * target;
        const ok1 = opt1 >= 1 && opt1 <= n;
        let ok2 = false;
        if (target !== 0 && v % target === 0) {
          const opt2 = v / target;
          ok2 = opt2 >= 1 && opt2 <= n;
        }
        return ok1 || ok2;
      }
      return true;
    }

    return true;
  }

  // ---------------- Çakışma bulma (satır/sütun/kafes) ----------------
  function findConflicts(n, cages, board) {
    const conflicts = new Set();

    for (let r = 0; r < n; r++) {
      const seen = new Map();
      for (let c = 0; c < n; c++) {
        const v = board[r][c];
        if (v) {
          if (!seen.has(v)) seen.set(v, []);
          seen.get(v).push(key(r, c));
        }
      }
      for (const cells of seen.values())
        if (cells.length > 1) cells.forEach(k => conflicts.add(k));
    }

    for (let c = 0; c < n; c++) {
      const seen = new Map();
      for (let r = 0; r < n; r++) {
        const v = board[r][c];
        if (v) {
          if (!seen.has(v)) seen.set(v, []);
          seen.get(v).push(key(r, c));
        }
      }
      for (const cells of seen.values())
        if (cells.length > 1) cells.forEach(k => conflicts.add(k));
    }

    for (const cage of cages) {
      const vals = cage.cells.map(([r, c]) => board[r][c]);
      const filled = vals.filter(v => v !== 0);
      let ok;
      if (filled.length === cage.cells.length) {
        ok = checkCageComplete(cage, vals);
      } else {
        ok = checkCagePartialOk(cage, filled, n);
      }
      if (!ok) cage.cells.forEach(([r, c]) => conflicts.add(key(r, c)));
    }

    const result = new Set();
    for (const k of conflicts) {
      const [r, c] = unkey(k);
      result.add(r + "," + c);
    }
    return result;
  }

  class SolveAborted extends Error {}

  // ---------------- Çözücü (kafes-farkında MRV + backtracking) ----------------
  function solveAll(n, cages, givenBoard, limit = 1, nodeLimit = null) {
    const cageMap = {};
    cages.forEach((cage, idx) => {
      cage.cells.forEach(([r, c]) => { cageMap[key(r, c)] = idx; });
    });

    const board = givenBoard.map(row => row.slice());
    const rows = new Array(n).fill(0);
    const cols = new Array(n).fill(0);
    let empties = [];

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = board[r][c];
        if (v) {
          const bit = 1 << (v - 1);
          rows[r] |= bit;
          cols[c] |= bit;
        } else {
          empties.push([r, c]);
        }
      }
    }

    const cageRemaining = {};
    cages.forEach((cage, idx) => {
      const filled = cage.cells.filter(([r, c]) => board[r][c] !== 0).length;
      cageRemaining[idx] = cage.cells.length - filled;
    });

    const fullMask = (1 << n) - 1;
    const solutions = [];
    let nodes = 0;

    function backtrack(remaining) {
      if (nodeLimit !== null) {
        nodes++;
        if (nodes > nodeLimit) throw new SolveAborted();
      }

      if (remaining.length === 0) {
        solutions.push(board.map(row => row.slice()));
        return solutions.length >= limit;
      }

      let best = null, bestMask = 0, bestKey = null;

      for (const [r, c] of remaining) {
        const used = rows[r] | cols[c];
        const avail = fullMask & ~used;
        const cnt = popcount(avail);
        if (cnt === 0) return false;

        const idx = cageMap[key(r, c)];
        const k0 = cnt, k1 = cageRemaining[idx];
        if (bestKey === null || k0 < bestKey[0] || (k0 === bestKey[0] && k1 < bestKey[1])) {
          bestKey = [k0, k1];
          best = [r, c];
          bestMask = avail;
          if (cnt === 1 && cageRemaining[idx] <= 1) break;
        }
      }

      const [r, c] = best;
      const newRemaining = remaining.filter(([rr, cc]) => !(rr === r && cc === c));
      const idx = cageMap[key(r, c)];
      const cage = cages[idx];
      const cageCells = cage.cells;

      let mask = bestMask;
      while (mask) {
        const bit = mask & (-mask);
        mask ^= bit;
        const v = bitToValue(bit);

        board[r][c] = v;
        rows[r] |= bit;
        cols[c] |= bit;
        cageRemaining[idx] -= 1;

        const cageVals = cageCells.map(([rr, cc]) => board[rr][cc]);
        const filled = cageVals.filter(x => x !== 0);
        let ok;
        if (filled.length === cageCells.length) {
          ok = checkCageComplete(cage, cageVals);
        } else {
          ok = checkCagePartialOk(cage, filled, n);
        }

        if (ok) {
          if (backtrack(newRemaining)) return true;
        }

        board[r][c] = 0;
        rows[r] &= ~bit;
        cols[c] &= ~bit;
        cageRemaining[idx] += 1;
      }

      return false;
    }

    let aborted = false;
    try {
      backtrack(empties);
    } catch (e) {
      if (e instanceof SolveAborted) aborted = true;
      else throw e;
    }

    return { solutions, aborted };
  }

  // ---------------- Bulmaca üretimi (tek çözüm garantisine çalışır) ----------------
  function generatePuzzle(n, maxAttempts = 40, nodeLimit = 250000, timeBudget = 10000) {
    const startTime = Date.now();
    let fallback = null;
    let cages = [], solution = [];

    let attempts = 0;
    while (attempts < maxAttempts && (Date.now() - startTime) < timeBudget) {
      attempts++;
      solution = generateLatinSquare(n);
      cages = generateCages(solution, n);
      const emptyBoard = Array.from({ length: n }, () => new Array(n).fill(0));

      const { solutions: sols, aborted } = solveAll(n, cages, emptyBoard, 2, nodeLimit);

      if (aborted) continue;

      if (sols.length === 1) {
        return { cages, solution };
      }

      if (fallback === null) fallback = { cages, solution };
    }

    if (fallback !== null) return fallback;
    return { cages, solution };
  }

  const KenKenEngine = {
    generateLatinSquare,
    computeCageClue,
    cageSizeDistribution,
    generateCages,
    checkCageComplete,
    checkCagePartialOk,
    findConflicts,
    solveAll,
    generatePuzzle,
  };

  global.KenKenEngine = KenKenEngine;
})(typeof self !== 'undefined' ? self : this);