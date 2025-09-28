
const GRID = 10, MAX_CELLS = GRID * GRID;
const STEP_DELAY_MS = 200;
const MAX_ACTIONS = 300; 
const STARTING_POINTS = 10; 

const boardEl = document.getElementById('board'),
  pointsEl = document.getElementById('points'),
  messageEl = document.getElementById('message'),
  levelTitleEl = document.getElementById('levelTitle'),
  runBtn = document.getElementById('runBtn'),
  restartBtn = document.getElementById('restartBtn'),
  codeArea = document.getElementById('code');

let currentLevel = 1;
let playerPos = MAX_CELLS - 1;
let targetPos = 0;
let points = STARTING_POINTS;
let actionQueue = [];
let isRunning = false;
let walls = [];
let enemies = []; 
let keys = new Set(); 
let collectedKeys = new Set();
let unlockedLevels = [1];
let keysToCollect = 0;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, length = 0.12, type = 'sine') {
  try {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(audioCtx.destination);
    g.gain.value = 0.12;
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + length);
    setTimeout(() => { o.stop(); }, length * 1000 + 30);
  } catch (e) { }
}
function soundEvent(name) {
  if (name === 'win') { playTone(880, 0.08); setTimeout(()=>playTone(1320,0.08),'90'); }
  else if (name === 'hit') { playTone(200, 0.18, 'square'); }
  else if (name === 'collect') { playTone(660, 0.08); setTimeout(()=>playTone(880,0.06),90); }
  else if (name === 'start') { playTone(440, 0.08); setTimeout(()=>playTone(660,0.06),90); }
  else if (name === 'gameover') { playTone(150, 0.25, 'sawtooth'); setTimeout(()=>playTone(120,0.25,'sawtooth'),300); }
}

function xy(pos) { return { x: pos % GRID, y: Math.floor(pos / GRID) }; }
function idx(x, y) { return y * GRID + x; }
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

function distanceToTarget(pos) {
  const a = xy(pos), b = xy(targetPos);
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function updatePointsUI() { pointsEl.innerText = `POINTs: ${points}`; }
function setMessage(txt, ok = false) {
  messageEl.style.color = ok ? '#28a745' : '#dc3545';
  messageEl.innerText = txt || '';
}

function drawBoard() {
  boardEl.innerHTML = '';
  for (let i = 0; i < MAX_CELLS; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    if (walls.includes(i)) d.classList.add('wall');
    if (i === playerPos) {
      const el = document.createElement('div');
      el.className = 'player';
      el.innerText = '🙂';
      d.appendChild(el);
    }
    if (i === targetPos) {
      const el = document.createElement('div');
      el.className = 'target';
      el.innerText = '🏁';
      d.appendChild(el);
    }
    if (keys.has(i) && !collectedKeys.has(i)) {
      const el = document.createElement('div');
      el.className = 'key';
      el.innerText = '🔑';
      d.appendChild(el);
    }
    const enemy = enemies.find(e => e.pos === i);
    if (enemy) {
      const el = document.createElement('div');
      el.className = 'enemy';
      el.innerText = '👾';
      d.appendChild(el);
    }
    boardEl.appendChild(d);
  }
}

function checkN(n) {
  if (n === undefined) throw new Error("❌ Потрібно вказати кількість кроків n");
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) throw new Error("❌ n має бути додатнім цілим числом");
  if (actionQueue.length + n > MAX_ACTIONS) throw new Error("❌ Забагато дій. Скороти або використай цикли/функції.");
}
function moveUp(n) { checkN(n); for (let i = 0; i < n; i++) actionQueue.push('up'); }
function moveDown(n) { checkN(n); for (let i = 0; i < n; i++) actionQueue.push('down'); }
function moveLeft(n) { checkN(n); for (let i = 0; i < n; i++) actionQueue.push('left'); }
function moveRight(n) { checkN(n); for (let i = 0; i < n; i++) actionQueue.push('right'); }

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function executeQueue() {
  if (isRunning) return;
  if (!actionQueue.length) { setMessage("⚠️ Немає дій", false); return; }
  isRunning = true;
  runBtn.disabled = true;
  setMessage("Виконується...", true);
  soundEvent('start');

  while (actionQueue.length) {
    const act = actionQueue.shift();
    const old = playerPos;
    let newPos = playerPos;

    if (act === 'up' && playerPos >= GRID) newPos = playerPos - GRID;
    else if (act === 'down' && playerPos < MAX_CELLS - GRID) newPos = playerPos + GRID;
    else if (act === 'left' && playerPos % GRID !== 0) newPos = playerPos - 1;
    else if (act === 'right' && playerPos % GRID !== GRID - 1) newPos = playerPos + 1;

    if (walls.includes(newPos)) {
      points -= 2; 
      soundEvent('hit');
      setMessage(`💥 Ти влучив у стіну! -2 POINTs (залишилось ${points})`, false);
      if (points <= 0) { await onGameOver(); return; }
      playerPos = getLevelStart(currentLevel);
      drawBoard();
      await sleep(700);
      continue;
    } else {
      playerPos = newPos;
    }

    if (keys.has(playerPos) && !collectedKeys.has(playerPos)) {
      collectedKeys.add(playerPos);
      points += 3;
      soundEvent('collect');
      setMessage(`✨ Ключ зібрано! +3 POINTs (разом ${points})`, true);
    } else {
      if (distanceToTarget(playerPos) < distanceToTarget(old)) {
        points += 1;
      } else {
        points = Math.max(0, points - 0);
      }
    }

    moveEnemiesStep();

    const collEnemy = enemies.find(e => e.pos === playerPos);
    if (collEnemy) {
      points -= collEnemy.damage || 2;
      soundEvent('hit');
      setMessage(`👾 Удар ворога! -${collEnemy.damage||2} POINTs (залишилось ${points})`, false);
      playerPos = getLevelStart(currentLevel); 
      if (points <= 0) { await onGameOver(); return; }
    }

    updatePointsUI();
    drawBoard();
    await sleep(STEP_DELAY_MS);
  }

  isRunning = false;
  runBtn.disabled = false;
  checkWin();
}

function moveEnemiesStep() {
  for (let e of enemies) {
    if (!e.path || e.path.length === 0) continue;
    e.stepIndex = (e.stepIndex + e.speed) % e.path.length;
    e.pos = e.path[e.stepIndex];
  }
}

function checkWin() {
  if (playerPos === targetPos) {
    if (currentLevel === 3 && collectedKeys.size < keysToCollect) {
      setMessage(`🔒 Потрібно зібрати всі ключі (${collectedKeys.size}/${keysToCollect})`, false);
      return;
    }
    soundEvent('win');
    points += 5; 
    setMessage(`✅ Пройшов рівень ${currentLevel}! +5 POINTs (разом ${points})`, true);
    updatePointsUI();
    if (currentLevel < 3 && !unlockedLevels.includes(currentLevel + 1)) unlockedLevels.push(currentLevel + 1);
    updateLevelButtons();
    if (currentLevel < 3) setTimeout(() => setLevel(currentLevel + 1), 1400);
    else { setMessage("🎉 Вітаю! Ти пройшов усі рівні!", true); }
  } else {
    setMessage("😕 Ти ще не дійшов до цілі!", false);
  }
}

async function onGameOver() {
  soundEvent('gameover');
  setMessage("❌ Усі POINTи втрачені! Гра завершена.", false);
  runBtn.disabled = true;
  isRunning = false;
  await sleep(1500);
  unlockedLevels = [1];
  setTimeout(() => setLevel(1), 1000);
}

function getLevelStart(level) {
  if (level === 1) return MAX_CELLS - 1;
  if (level === 2) return idx(0,9);
  if (level === 3) return idx(1,9);
  return MAX_CELLS - 1;
}
function initLevelData(level) {
  walls = [];
  enemies = [];
  keys = new Set();
  collectedKeys = new Set();
  keysToCollect = 0;

  if (level === 1) {
    playerPos = getLevelStart(1);
    targetPos = idx(9,0);
    codeArea.value = "// Рівень 1 — простий. Спробуй: moveUp(9); moveRight(9);";
    for (let x=3; x<6; x++) walls.push(idx(x,7));
  }

  else if (level === 2) {
    playerPos = getLevelStart(2);
    targetPos = idx(9,0);
    codeArea.value = "// Рівень 2 — лабіринт. Використай цикли (for) або функції. Шляхи частково випадкові!";
    const seed = Date.now();
    for (let i=0; i<16; i++) {
      let attempt = 0;
      while (attempt++ < 30) {
        const x = randInt(0,9), y = randInt(1,8);
        const p = idx(x,y);
        if (p===playerPos || p===targetPos) continue;
        if (!walls.includes(p)) { walls.push(p); break; }
      }
    }
    const path = [];
    const y = 5;
    for (let x=1; x<9; x++) path.push(idx(x,y));
    enemies.push({ pos: path[0], path, stepIndex:0, speed:1, damage:2 });
  }

  else if (level === 3) {
    playerPos = getLevelStart(3);
    targetPos = idx(9,0);
    codeArea.value = "// Рівень 3 — зберіть усі ключі перед фінішем. Використайте цикли, функції, логіку.";

    for (let i=0;i<28;i++) {
      let attempt = 0;
      while (attempt++ < 40) {
        const x = randInt(0,9), y = randInt(1,8);
        const p = idx(x,y);
        if ([playerPos,targetPos].includes(p)) continue;
        if (!walls.includes(p)) { walls.push(p); break; }
      }
    }
    keysToCollect = randInt(2,3);
    let kcount = 0;
    while (kcount < keysToCollect) {
      const x = randInt(0,9), y = randInt(0,9);
      const p = idx(x,y);
      if ([playerPos,targetPos].includes(p)) continue;
      if (walls.includes(p) || keys.has(p)) continue;
      keys.add(p); kcount++;
    }
    const path1 = [];
    for (let y=2; y<8; y++) path1.push(idx(3,y));
    enemies.push({ pos: path1[0], path: path1, stepIndex:0, speed:1, damage:3 });
    // ворог 2: змійка по кільцю
    const path2 = [];
    for (let x=4;x<9;x++) path2.push(idx(x,2));
    for (let y=2;y<6;y++) path2.push(idx(8,y));
    for (let x=8;x>3;x--) path2.push(idx(x,5));
    enemies.push({ pos: path2[0], path: path2, stepIndex:0, speed:1, damage:2 });
  }
}

function updateLevelButtons() {
  document.querySelectorAll("button.level").forEach((btn,i) => {
    const lvl = i+1;
    if (unlockedLevels.includes(lvl)) { btn.disabled = false; btn.innerText = "Рівень " + lvl; }
    else { btn.disabled = true; btn.innerText = "🔒 Рівень " + lvl; }
  });
}

function setLevel(level) {
  if (isRunning) return;
  if (!unlockedLevels.includes(level)) return;
  currentLevel = level;
  actionQueue = [];
  points = Math.max(points, 1);
  setMessage('', true);
  initLevelData(level);
  updatePointsUI();
  drawBoard();
  levelTitleEl.innerText = `Рівень ${level}`;
  updateLevelButtons();
}
function runCode() {
  if (isRunning) return;
  actionQueue = [];
  setMessage('', true);
  try {
    eval(codeArea.value);
  } catch (e) {
    setMessage("Помилка в коді: " + e.message, false);
    actionQueue = [];
    return;
  }
  executeQueue();
}

function forceRestart() {
  unlockedLevels = [1];
  points = STARTING_POINTS;
  setLevel(1);
  updatePointsUI();
  setMessage("🔁 Гра рестартована", true);
}

function updatePointsUI() { pointsEl.innerText = `POINTs: ${points}`; }

window.moveUp = moveUp;
window.moveDown = moveDown;
window.moveLeft = moveLeft;
window.moveRight = moveRight;
window.setLevel = setLevel;
window.runCode = runCode;
window.forceRestart = forceRestart;

points = STARTING_POINTS;
setLevel(1);
updateLevelButtons();
updatePointsUI();
setMessage("Починай кодити!", true);
soundEvent('start');
