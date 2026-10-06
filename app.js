// app.js — SudokuGame / KenKenGame sınıflarının web karşılığı
(function () {
  'use strict';

  // ================= SABİTLER =================
  const LEVELS = [
    ["Çok Kolay", 4],
    ["Kolay", 5],
    ["Normal", 6],
    ["Zor", 7],
    ["Çok Zor", 8],
    ["En Zor", 9],
  ];

  const THIN = 'var(--thin)';
  const THICK = 'var(--thick)';

  // ================= WORKER YÖNETİMİ =================
  const worker = new Worker('worker.js');
  let reqCounter = 0;
  const pendingRequests = new Map();

  worker.onmessage = (e) => {
    const { type, requestId, payload } = e.data;
    const resolver = pendingRequests.get(requestId);
    if (!resolver) return;
    pendingRequests.delete(requestId);
    if (type === 'error') resolver.reject(payload);
    else resolver.resolve(payload);
  };

  function callWorker(type, payload) {
    return new Promise((resolve, reject) => {
      const requestId = ++reqCounter;
      pendingRequests.set(requestId, { resolve, reject });
      worker.postMessage({ type, payload, requestId });
    });
  }

  // ================= MODAL (alert / confirm) =================
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalMessage = document.getElementById('modal-message');
  const modalActions = document.getElementById('modal-actions');

  function showAlert(title, message) {
    return new Promise((resolve) => {
      modalTitle.textContent = title;
      modalMessage.textContent = message;
      modalActions.innerHTML = '';
      const btn = document.createElement('button');
      btn.textContent = 'Tamam';
      btn.addEventListener('click', () => { modalOverlay.classList.add('hidden'); resolve(); });
      modalActions.appendChild(btn);
      modalOverlay.classList.remove('hidden');
    });
  }

  function showConfirm(title, message) {
    return new Promise((resolve) => {
      modalTitle.textContent = title;
      modalMessage.textContent = message;
      modalActions.innerHTML = '';

      const btnNo = document.createElement('button');
      btnNo.textContent = 'Hayır';
      btnNo.addEventListener('click', () => { modalOverlay.classList.add('hidden'); resolve(false); });

      const btnYes = document.createElement('button');
      btnYes.textContent = 'Evet';
      btnYes.classList.add('destructive');
      btnYes.addEventListener('click', () => { modalOverlay.classList.add('hidden'); resolve(true); });

      modalActions.appendChild(btnNo);
      modalActions.appendChild(btnYes);
      modalOverlay.classList.remove('hidden');
    });
  }

  // ================= IZGARA OLUŞTURUCU (ortak) =================
  function buildCageGrid(container, n, cages, onCellInput) {
    container.innerHTML = '';

    const cageMap = {};
    cages.forEach((cage, idx) => {
      cage.cells.forEach(([r, c]) => { cageMap[`${r},${c}`] = idx; });
    });

    const clueCellOfCage = {};
    cages.forEach((cage, idx) => {
      let min = cage.cells[0];
      for (const cell of cage.cells) {
        if (cell[0] < min[0] || (cell[0] === min[0] && cell[1] < min[1])) min = cell;
      }
      clueCellOfCage[idx] = `${min[0]},${min[1]}`;
    });

    const cellEls = {};
    const inputEls = {};
    const clueEls = {};

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const sameLeft = c > 0 && cageMap[`${r},${c - 1}`] === cageMap[`${r},${c}`];
        const sameTop = r > 0 && cageMap[`${r - 1},${c}`] === cageMap[`${r},${c}`];

        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.style.borderTopWidth = (r === 0) ? THICK : (sameTop ? THIN : THICK);
        cell.style.borderLeftWidth = (c === 0) ? THICK : (sameLeft ? THIN : THICK);
        cell.style.borderRightWidth = (c === n - 1) ? THICK : '0px';
        cell.style.borderBottomWidth = (r === n - 1) ? THICK : '0px';

        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.pattern = '[0-9]*';
        input.maxLength = 1;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.className = 'cell-input';
        input.style.color = '#007aff';

        input.addEventListener('input', (e) => {
          let v = e.target.value.replace(/[^0-9]/g, '');
          if (v.length > 1) v = v.slice(-1);
          if (v !== '' && (parseInt(v, 10) < 1 || parseInt(v, 10) > n)) v = '';
          e.target.value = v;
          if (onCellInput) onCellInput(r, c);
        });

        cell.appendChild(input);

        const idx = cageMap[`${r},${c}`];
        if (clueCellOfCage[idx] === `${r},${c}`) {
          const cage = cages[idx];
          const clue = document.createElement('span');
          clue.className = 'clue-label';
          clue.textContent = `${cage.target}${cage.op}`;
          cell.appendChild(clue);
          clueEls[idx] = clue;
        }

        container.appendChild(cell);
        cellEls[`${r},${c}`] = cell;
        inputEls[`${r},${c}`] = input;
      }
    }

    container.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${n}, 1fr)`;

    scaleBoardFonts(container, n);
    return { cellEls, inputEls, cageMap, clueCellOfCage, clueEls };
  }

  function scaleBoardFonts(boardEl, n) {
    requestAnimationFrame(() => {
      const rect = boardEl.getBoundingClientRect();
      if (rect.width === 0) return;
      const cellSize = rect.width / n;
      const fontSize = Math.max(10, cellSize * 0.48);
      const clueSize = Math.max(7, cellSize * 0.17);
      boardEl.querySelectorAll('.cell-input').forEach(inp => inp.style.fontSize = fontSize + 'px');
      boardEl.querySelectorAll('.clue-label').forEach(lbl => lbl.style.fontSize = clueSize + 'px');
    });
  }

  function setCellColors(cellEl, inputEl, clueEl, bg, fg) {
    cellEl.style.background = bg;
    inputEl.style.background = bg;
    inputEl.style.color = fg;
    if (clueEl) clueEl.style.background = bg;
  }

  // =========================================================
  //   ANA OYUN DURUMU
  // =========================================================
  const Game = {
    n: 4,
    cages: [],
    cageMap: {},
    cellEls: {},
    inputEls: {},
    clueEls: {},
    clueCellOfCage: {},
    solution: [],
    prevWrong: {},
    totalMistakes: 0,
    startTime: null,
    timerInterval: null,
    gameFinished: false,
    currentLevelName: '',
    generating: false,
    destekEnabled: true,
  };

  const boardEl = document.getElementById('board');
  const levelsGrid = document.getElementById('levels-grid');
  const lblError = document.getElementById('lbl-error');
  const lblLevel = document.getElementById('lbl-level');
  const lblTime = document.getElementById('lbl-time');
  const chkDestek = document.getElementById('chk-destek');

  let levelButtons = [];

  function buildLevelButtons() {
    levelsGrid.innerHTML = '';
    levelButtons = LEVELS.map(([name, size]) => {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      btn.textContent = name;
      btn.addEventListener('click', () => newGame(size, name, true));
      levelsGrid.appendChild(btn);
      return btn;
    });
  }

  function setLevelButtonsState(enabled) {
    levelButtons.forEach(b => b.disabled = !enabled);
  }

  function gameInProgress() {
    if (Game.gameFinished) return false;
    for (let r = 0; r < Game.n; r++)
      for (let c = 0; c < Game.n; c++)
        if (Game.inputEls[`${r},${c}`].value.trim() !== '') return true;
    return false;
  }

  async function newGame(size, levelName, askConfirm) {
    if (Game.generating) return;

    if (askConfirm && gameInProgress()) {
      const ok = await showConfirm(
        'Yeni Oyun',
        'Mevcut oyun tamamlanmadı. Yeni bir oyuna başlamak istediğinize emin misiniz?'
      );
      if (!ok) return;
    }

    Game.generating = true;
    stopTimer();
    setLevelButtonsState(false);
    lblLevel.textContent = `Seviye: ${levelName} (üretiliyor...)`;
    lblTime.textContent = 'Geçen Zaman : 00:00';

    try {
      const { cages, solution } = await callWorker('generatePuzzle', { n: size });
      applyNewGame(cages, solution, levelName);
    } catch (err) {
      await showAlert('Hata', 'Bulmaca üretilirken bir hata oluştu.');
    } finally {
      setLevelButtonsState(true);
      Game.generating = false;
    }
  }

  function applyNewGame(cages, solution, levelName) {
    const n = solution.length;
    Game.n = n;
    Game.cages = cages;
    Game.cageMap = {};
    cages.forEach((cage, idx) => cage.cells.forEach(([r, c]) => { Game.cageMap[`${r},${c}`] = idx; }));

    const built = buildCageGrid(boardEl, n, cages, onCellChange);
    Game.cellEls = built.cellEls;
    Game.inputEls = built.inputEls;
    Game.clueEls = built.clueEls;
    Game.clueCellOfCage = built.clueCellOfCage;

    Game.solution = solution;
    Game.gameFinished = false;
    Game.currentLevelName = levelName;
    Game.prevWrong = {};
    Game.totalMistakes = 0;

    lblError.textContent = 'Yapılan Hata Sayısı : 0';
    lblLevel.textContent = `Seviye: ${levelName} (${n}x${n})`;
    Game.startTime = Date.now();
    startTimer();
  }

  function getCurrentBoard(n, inputEls) {
    const board = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const t = inputEls[`${r},${c}`].value.trim();
        if (t) board[r][c] = parseInt(t, 10);
      }
    return board;
  }

  function recalcBoardState() {
    if (Game.gameFinished) return;
    const n = Game.n;
    const board = getCurrentBoard(n, Game.inputEls);
    const conflicts = KenKenEngine.findConflicts(n, Game.cages, board);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const key = `${r},${c}`;
        const inputEl = Game.inputEls[key];
        const cellEl = Game.cellEls[key];
        const idx = Game.cageMap[key];
        const clueEl = (Game.clueCellOfCage[idx] === key) ? Game.clueEls[idx] : null;
        const txt = inputEl.value.trim();

        if (txt === '') {
          setCellColors(cellEl, inputEl, clueEl, '#fff', '#007aff');
          Game.prevWrong[key] = false;
          continue;
        }

        const val = parseInt(txt, 10);
        const isWrong = (val !== Game.solution[r][c]);
        const wasWrong = Game.prevWrong[key] || false;

        if (isWrong && !wasWrong) Game.totalMistakes++;
        Game.prevWrong[key] = isWrong;

        const isConflict = conflicts.has(key);

        if (isConflict) {
          setCellColors(cellEl, inputEl, clueEl, '#ffcc80', '#000');
        } else if (Game.destekEnabled) {
          setCellColors(cellEl, inputEl, clueEl, '#fff', isWrong ? '#ff3b30' : '#007aff');
        } else {
          setCellColors(cellEl, inputEl, clueEl, '#fff', '#007aff');
        }
      }
    }

    lblError.textContent = `Yapılan Hata Sayısı : ${Game.totalMistakes}`;
  }

  function onCellChange(r, c) {
    if (Game.gameFinished) return;
    recalcBoardState();
    checkWin();
  }

  function checkWin() {
    if (Game.gameFinished) return;
    const n = Game.n;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (Game.inputEls[`${r},${c}`].value.trim() === '') return;

    const board = getCurrentBoard(n, Game.inputEls);
    if (KenKenEngine.findConflicts(n, Game.cages, board).size > 0) return;

    finishGame();
  }

  async function finishGame() {
    stopTimer();
    Game.gameFinished = true;

    const elapsed = Math.floor((Date.now() - Game.startTime) / 1000);
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    const timeStr = m > 0 ? `${m} dakika ${s} saniye` : `${s} saniye`;

    let msg;
    if (Game.totalMistakes === 0) {
      msg = `Kendoku'yu HATASIZ bir şekilde ${timeStr}de tamamladınız!`;
    } else {
      msg = `Kendoku'yu ${Game.totalMistakes} hatayla ${timeStr}de tamamladınız!`;
    }

    for (let r = 0; r < Game.n; r++)
      for (let c = 0; c < Game.n; c++)
        Game.inputEls[`${r},${c}`].disabled = true;

    await showAlert('Tebrikler!', msg);
  }

  function startTimer() {
    stopTimer();
    Game.timerInterval = setInterval(() => {
      if (Game.startTime === null) return;
      const elapsed = Math.floor((Date.now() - Game.startTime) / 1000);
      const m = Math.floor(elapsed / 60), s = elapsed % 60;
      lblTime.textContent = `Geçen Zaman : ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, 1000);
  }
  function stopTimer() {
    if (Game.timerInterval) clearInterval(Game.timerInterval);
    Game.timerInterval = null;
  }

  chkDestek.addEventListener('change', () => {
    Game.destekEnabled = chkDestek.checked;
    recalcBoardState();
  });

  window.addEventListener('resize', () => scaleBoardFonts(boardEl, Game.n));
  window.addEventListener('orientationchange', () => setTimeout(() => scaleBoardFonts(boardEl, Game.n), 300));

  // =========================================================
  //   ÇÖZÜCÜ EKRANI
  // =========================================================
  const Solver = {
    n: 4,
    cages: [],
    cageMap: {},
    cellEls: {},
    inputEls: {},
    clueEls: {},
    clueCellOfCage: {},
    givenMask: {},
    solutions: [],
    solIndex: -1,
    lastKey: null,
    busy: false,
  };

  const solverBoardEl = document.getElementById('solver-board');
  const solverInfo = document.getElementById('solver-info');
  const solverStatus = document.getElementById('solver-status');

  function rebuildSolverGrid(n, cages) {
    Solver.n = n;
    Solver.cages = cages;
    Solver.cageMap = {};
    cages.forEach((cage, idx) => cage.cells.forEach(([r, c]) => { Solver.cageMap[`${r},${c}`] = idx; }));

    const built = buildCageGrid(solverBoardEl, n, cages, null);
    Solver.cellEls = built.cellEls;
    Solver.inputEls = built.inputEls;
    Solver.clueEls = built.clueEls;
    Solver.clueCellOfCage = built.clueCellOfCage;
    Solver.givenMask = {};
  }

  function solverLoadFromGame() {
    rebuildSolverGrid(Game.n, Game.cages);
    const board = getCurrentBoard(Game.n, Game.inputEls);
    for (let r = 0; r < Game.n; r++) {
      for (let c = 0; c < Game.n; c++) {
        const v = board[r][c];
        if (v !== 0) {
          const inp = Solver.inputEls[`${r},${c}`];
          inp.value = String(v);
          inp.style.color = '#007aff';
        }
      }
    }
    Solver.lastKey = null;
    Solver.solutions = [];
    Solver.solIndex = -1;
    solverStatus.textContent = "Oyundan aktarıldı. 'Çözüm' butonuna basabilirsiniz.";
    solverInfo.textContent = '';
  }

  function solverClear() {
    for (const key in Solver.inputEls) {
      const inp = Solver.inputEls[key];
      inp.disabled = false;
      inp.value = '';
      inp.style.color = '#007aff';
      inp.style.background = '#fff';
      Solver.cellEls[key].style.background = '#fff';
    }
    Solver.lastKey = null;
    Solver.solutions = [];
    Solver.solIndex = -1;
    solverStatus.textContent = '';
  }

  function solverReadBoard() {
    const n = Solver.n;
    const board = Array.from({ length: n }, () => new Array(n).fill(0));
    const given = {};
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const t = Solver.inputEls[`${r},${c}`].value.trim();
        if (t) { board[r][c] = parseInt(t, 10); given[`${r},${c}`] = true; }
      }
    return { board, given };
  }

  async function solverSolveOrNext() {
    if (Solver.busy) return;

    if (!Solver.cages || Solver.cages.length === 0) {
      await showAlert('Uyarı', "Önce 'Oyundan Al' ile bir bulmaca yükleyin.");
      return;
    }

    const { board, given } = solverReadBoard();
    const conflicts = KenKenEngine.findConflicts(Solver.n, Solver.cages, board);
    if (conflicts.size > 0) {
      await showAlert('Hata', 'Girilen değerlerde çakışma var, lütfen kontrol ediniz.');
      return;
    }

    const keyStr = JSON.stringify(board);

    if (keyStr === Solver.lastKey && Solver.solutions.length > 0) {
      Solver.solIndex = (Solver.solIndex + 1) % Solver.solutions.length;
      solverDisplaySolution();
      solverUpdateStatus();
      return;
    }

    Solver.lastKey = keyStr;
    Solver.givenMask = given;
    Solver.busy = true;
    solverStatus.textContent = 'Çözülüyor, lütfen bekleyin...';

    try {
      const { solutions, aborted } = await callWorker('solveAll', {
        n: Solver.n, cages: Solver.cages, board, limit: 50
      });

      Solver.busy = false;
      Solver.solutions = solutions;
      Solver.solIndex = 0;

      if (!solutions || solutions.length === 0) {
        solverStatus.textContent = 'Çözüm bulunamadı.';
        await showAlert('Hata', 'Bu bulmaca için çözüm bulunamadı.');
        return;
      }

      solverDisplaySolution();
      solverUpdateStatus();
    } catch (err) {
      Solver.busy = false;
      solverStatus.textContent = 'Bir hata oluştu.';
    }
  }

  function solverUpdateStatus() {
    const total = Solver.solutions.length;
    if (total === 1) {
      solverStatus.textContent = 'Çözüldü. (Bu bulmacanın tek çözümü var)';
    } else {
      const suffix = total === 50 ? '+' : '';
      solverStatus.textContent =
        `Çözüm ${Solver.solIndex + 1} / ${total}${suffix}  — Tekrar 'Çözüm'e basarak diğerlerini görebilirsiniz.`;
    }
  }

  function solverDisplaySolution() {
    const sol = Solver.solutions[Solver.solIndex];
    for (let r = 0; r < Solver.n; r++) {
      for (let c = 0; c < Solver.n; c++) {
        const key = `${r},${c}`;
        const inp = Solver.inputEls[key];
        inp.disabled = false;
        inp.value = String(sol[r][c]);
        inp.style.color = Solver.givenMask[key] ? '#000' : '#007aff';
      }
    }
  }

  async function solverTransferToGame() {
    if (!Solver.solutions.length || Solver.solIndex < 0) {
      await showAlert('Uyarı', "Önce 'Çözüm' butonuna basarak bir çözüm bulmalısınız.");
      return;
    }
    applySolutionToGame(Solver.solutions[Solver.solIndex]);
    await showAlert('Bilgi', 'Çözüm oyun ekranına aktarıldı.');
  }

  function applySolutionToGame(solvedBoard) {
    if (solvedBoard.length !== Game.n) {
      showAlert('Hata', 'Çözüm, mevcut oyun ile aynı boyutta değil.');
      return;
    }
    const wasFinished = Game.gameFinished;
    Game.gameFinished = false;

    for (let r = 0; r < Game.n; r++) {
      for (let c = 0; c < Game.n; c++) {
        const inp = Game.inputEls[`${r},${c}`];
        inp.disabled = false;
        inp.value = String(solvedBoard[r][c]);
      }
    }

    recalcBoardState();
    checkWin();

    if (!Game.gameFinished) Game.gameFinished = wasFinished;
  }

  // =========================================================
  //   EKRAN GEÇİŞLERİ
  // =========================================================
  const screenSolver = document.getElementById('screen-solver');
  const screenHowto = document.getElementById('screen-howto');

  document.getElementById('btn-solver').addEventListener('click', () => {
    screenSolver.classList.add('active');
    solverLoadFromGame();
    setTimeout(() => scaleBoardFonts(solverBoardEl, Solver.n), 50);
  });
  document.getElementById('solver-back').addEventListener('click', () => {
    screenSolver.classList.remove('active');
  });

  document.getElementById('btn-howto').addEventListener('click', () => {
    screenHowto.classList.add('active');
  });
  document.getElementById('howto-close').addEventListener('click', () => {
    screenHowto.classList.remove('active');
  });

  document.getElementById('solver-load').addEventListener('click', solverLoadFromGame);
  document.getElementById('solver-clear').addEventListener('click', solverClear);
  document.getElementById('solver-solve').addEventListener('click', solverSolveOrNext);
  document.getElementById('solver-transfer').addEventListener('click', solverTransferToGame);

  window.addEventListener('resize', () => scaleBoardFonts(solverBoardEl, Solver.n));

  // =========================================================
  //   iOS "Ana Ekrana Ekle" ipucu
  // =========================================================
  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }
  function isStandalone() {
    return ('standalone' in navigator) && navigator.standalone;
  }

  const iosBanner = document.getElementById('ios-banner');
  if (isIos() && !isStandalone() && !localStorage.getItem('iosBannerDismissed')) {
    iosBanner.classList.remove('hidden');
  }
  document.getElementById('ios-banner-close').addEventListener('click', () => {
    iosBanner.classList.add('hidden');
    localStorage.setItem('iosBannerDismissed', '1');
  });

  // =========================================================
  //   SERVICE WORKER
  // =========================================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // =========================================================
  //   BAŞLATMA
  // =========================================================
  buildLevelButtons();
  newGame(4, 'Çok Kolay', false);

})();

// python -m http.server 8000
// http://localhost:8000