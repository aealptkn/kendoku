// worker.js — Python'daki threading.Thread yaklaşımının web karşılığı
importScripts('engine.js');

self.onmessage = function (e) {
  const { type, payload, requestId } = e.data;

  try {
    if (type === 'generatePuzzle') {
      const { n } = payload;
      const result = KenKenEngine.generatePuzzle(n);
      self.postMessage({ type: 'generatePuzzleResult', requestId, payload: result });
    } else if (type === 'solveAll') {
      const { n, cages, board, limit } = payload;
      const result = KenKenEngine.solveAll(n, cages, board, limit, 3000000);
      self.postMessage({ type: 'solveAllResult', requestId, payload: result });
    }
  } catch (err) {
    self.postMessage({ type: 'error', requestId, payload: String(err) });
  }
};