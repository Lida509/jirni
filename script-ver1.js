const GRID = 10, MAX_CELLS = GRID * GRID, STEP_DELAY_MS = 200, MAX_ACTIONS = 500;

const boardEl = document.getElementById('board'),
  pointsEl = document.getElementById('points'),
  messageEl = document.getElementById('message'),
  levelTitleEl = document.getElementById('levelTitle'),
  runBtn = document.getElementById('runBtn'),
  livesEl = document.getElementById('lives');

let currentLevel = 1,
  playerPos = MAX_CELLS - 1,
  targetPos = 0,
  points = 0,
  actionQueue = [],
  isRunning = false;

let walls = [],
  unlockedLevels = [1],
  lives = 3;

function xy(pos) {
  return { x: pos % GRID, y: Math.floor(pos / GRID) };
}
function idx(x, y) {
  return y * GRID + x;
}
function distanceToTarget(pos) {
  const a = xy(pos), b = xy(targetPos);
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
function addPointsIfCloser(oldPos, newPos) {
  if (distanceToTarget(newPos) < distanceToTarget(oldPos)) points++;
  updatePointsUI();
}
function updatePointsUI() {
  pointsEl.innerText = "Очки: " + points;
}
function updateLivesUI() {
  livesEl.innerText = "❤️".repeat(lives);
}
function setMessage(txt, err = true) {
  messageEl.style.color = err ? '#dc3545' : '#28a745';
  messageEl.innerText = txt || '';
}

function updateLevelButtons() {
  document.querySelectorAll("button.level").forEach((btn, i) => {
    const lvl = i + 1;
    if (unlockedLevels.includes(lvl)) {
      btn.disabled = false;
      btn.innerText = "Рівень " + lvl;
    } else {
      btn.disabled = true;
      btn.innerText = "🔒 Рівень " + lvl;
    }
  });
}

function drawBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < MAX_CELLS; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    if (walls.includes(i)) d.classList.add('wall');
    if (i === playerPos) d.classList.add('player');
    if (i === targetPos) {
      d.classList.add('target');
      d.innerText = '🏁';
    }
    boardEl.appendChild(d);
  }
}

function setLevel(level) {
  if (isRunning) return;
  if (!unlockedLevels.includes(level)) return;
  currentLevel = level;
  points = 0;
  actionQueue = [];
  walls = [];
  setMessage('', false);
  levelTitleEl.innerText = "Рівень " + level;

  const codeArea = document.getElementById('code');

  if (level === 1) {
    playerPos = MAX_CELLS - 1;
    targetPos = 0;
    codeArea.value = "// Використай moveUp та moveLeft";
  } else if (level === 2) {
    playerPos = idx(0, 9);
    targetPos = idx(9, 0);
    codeArea.value = "// Використай вкладені цикли";
  } else if (level === 3) {
    playerPos = idx(2, 8);
    targetPos = idx(9, 0);
    codeArea.value = "// Створи функцію для повторних рухів";
  } else if (level === 4) {
    playerPos = idx(0, 9);
    targetPos = idx(9, 0);
    for (let y = 2; y < 8; y++) walls.push(idx(4, y));
    for (let x = 3; x < 9; x++) walls.push(idx(x, 5));
    codeArea.value = "// Обійди дві великі стіни";
  } else if (level === 5) {
    playerPos = idx(0, 9);
    targetPos = idx(9, 0);
    for (let y = 1; y < 9; y++) if (y !== 4) walls.push(idx(2, y));
    for (let x = 2; x < 9; x++) if (x !== 6) walls.push(idx(x, 6));
    for (let y = 2; y < 9; y++) if (y !== 7) walls.push(idx(7, y));
    for (let x = 4; x < 9; x++) if (x !== 5) walls.push(idx(x, 3));
    codeArea.value = "// Складний лабіринт!";
  }

  updatePointsUI();
  updateLivesUI();
  drawBoard();
  updateLevelButtons();
}

function checkN(n) {
  if (n === undefined) throw new Error("❌ Потрібно вказати кількість кроків n");
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) throw new Error("❌ n має бути додатнім числом");
  if (actionQueue.length + n > MAX_ACTIONS) throw new Error("❌ Забагато дій");
}
function moveUp(n) { checkN(n); for (let i = 0; i < n; i++) actionQueue.push('up'); }
function moveDown(n) { checkN(n); for (let i = 0; i < n; i++) actionQueue.push('down'); }
function moveLeft(n) { checkN(n); for (let i = 0; i < n; i++) actionQueue.push('left'); }
function moveRight(n) { checkN(n); for (let i = 0; i < n; i++) actionQueue.push('right'); }

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function executeQueue() {
  if (isRunning) return;
  if (!actionQueue.length) { setMessage("⚠️ Немає дій", true); return; }
  isRunning = true;
  runBtn.disabled = true;
  setMessage("Виконується...", false);
  while (actionQueue.length) {
    const act = actionQueue.shift();
    const old = playerPos;
    let newPos = playerPos;
    if (act === 'up' && playerPos >= GRID) newPos = playerPos - GRID;
    else if (act === 'down' && playerPos < MAX_CELLS - GRID) newPos = playerPos + GRID;
    else if (act === 'left' && playerPos % GRID !== 0) newPos = playerPos - 1;
    else if (act === 'right' && playerPos % GRID !== GRID - 1) newPos = playerPos + 1;

    if (walls.includes(newPos)) {
      lives--;
      updateLivesUI();
      setMessage("💔 Ти врізався в стіну! Залишилось життів: " + lives, true);

      if (lives > 0) {
        restartLevel();
      } else {
        resetGame();
      }

      isRunning = false;
      runBtn.disabled = false;
      return;
    } else {
      playerPos = newPos;
      addPointsIfCloser(old, playerPos);
    }

    drawBoard();
    await sleep(STEP_DELAY_MS);
  }
  isRunning = false;
  runBtn.disabled = false;
  checkWin();
}

function runCode() {
  if (isRunning) return;
  actionQueue = [];
  setMessage('', false);
  try {
    eval(document.getElementById('code').value);
  } catch (e) {
    setMessage(e.message, true);
    actionQueue = [];
    return;
  }
  executeQueue();
}

function checkWin() {
  if (playerPos === targetPos) {
    setMessage("✅ Пройшов рівень " + currentLevel + "! Очки: " + points, false);
    if (currentLevel < 5 && !unlockedLevels.includes(currentLevel + 1)) unlockedLevels.push(currentLevel + 1);
    updateLevelButtons();
    if (currentLevel < 5) setTimeout(() => setLevel(currentLevel + 1), 5000);
  } else {
    setMessage("😕 Ти ще не дійшов до цілі!", true);
  }
}

function restartLevel() {
  setTimeout(() => {
    setLevel(currentLevel);
    drawBoard();
  }, 500);
}

function resetGame() {
  setMessage("❌ Усі життя втрачені! Гра починається спочатку.", true);
  unlockedLevels = [1];
  lives = 3;
  points = 0;
  setTimeout(() => {
    setLevel(1);
    drawBoard();
  }, 1500);
}

setLevel(1);
updateLevelButtons();
window.moveUp = moveUp;
window.moveDown = moveDown;
window.moveLeft = moveLeft;
window.moveRight = moveRight;
window.setLevel = setLevel;
window.runCode = runCode;
