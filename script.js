const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreLabel = document.getElementById('score');
const targetLabel = document.getElementById('target');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const startBtn = document.getElementById('startBtn');
const difficultyLabel = document.getElementById('difficulty');
const difficultyMenu = document.getElementById('difficultyMenu');
const easyBtn = document.getElementById('easyBtn');
const hardBtn = document.getElementById('hardBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const modeFeedback = document.getElementById('modeFeedback');

const sprite = new Image();
sprite.src = 'sprit.png';
sprite.onload = () => drawFrame();

function getTheme() {
  return {
    sky: '#ffffff',
    ground: '#555',
    groundLine: '#cfcfcf',
    cloud: '#ececec',
    obstacle: '#333',
    obstacleAccent: '#222',
    dinoFill: '#1a1a1a',
    dinoEye: '#f7f7f7',
    hintBg: 'rgba(0,0,0,0.08)',
    hintText: '#333',
  };
}

let env = { TARGET_SCORE: 30 };
let state = {
  running: false,
  gameOver: false,
  victory: false,
  score: 0,
  speed: 6,
  baseSpeed: 6,
  distance: 0,
  lastTime: 0,
  obstacles: [],
  clouds: [],
  nextObstacleAt: 0,
  dino: {
    x: 40,
    y: 92,
    width: 56,
    height: 64,
    velY: 0,
    jumpPower: 14,
    gravity: 0.8,
    grounded: true,
    frameIndex: 0,
    frameTime: 0,
    spriteSets: {
      idle: [
        { x: 260, y: 430, w: 110, h: 155 },
        { x: 380, y: 430, w: 110, h: 155 },
        { x: 500, y: 430, w: 110, h: 155 },
        { x: 620, y: 430, w: 110, h: 155 },
      ],
      run: [
        { x: 260, y: 720, w: 110, h: 155 },
        { x: 380, y: 720, w: 110, h: 155 },
        { x: 500, y: 720, w: 110, h: 155 },
        { x: 620, y: 720, w: 110, h: 155 },
      ],
      jump: [
        { x: 260, y: 990, w: 110, h: 155 },
        { x: 380, y: 990, w: 110, h: 155 },
        { x: 500, y: 990, w: 110, h: 155 },
        { x: 620, y: 990, w: 110, h: 155 },
      ],
    },
  },
  attempts: 0,
  mode: 'difficult',
  easyRequestCount: 0,
};

const getCanvasWidth = () => Math.min(860, document.body.clientWidth - 32);
const getCanvasHeight = () => {
  const width = getCanvasWidth();
  return Math.min(200, Math.max(150, Math.round(width * 0.24)));
};

function setupCanvas() {
  const width = getCanvasWidth();
  const height = getCanvasHeight();
  canvas.width = width * window.devicePixelRatio;
  canvas.height = height * window.devicePixelRatio;
  canvas.style.width = '100%';
  canvas.style.height = `${height}px`;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function parseEnv(data) {
  data.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=');
    if (key && value) env[key.trim()] = value.trim();
  });
  env.TARGET_SCORE = Number(env.TARGET_SCORE) || 3000;
}

async function loadEnv() {
  try {
    const response = await fetch('.env');
    if (!response.ok) throw new Error('Env not found');
    const text = await response.text();
    parseEnv(text);
  } catch (error) {
    console.warn('Impossible de charger .env, valeur par défaut utilisée.');
  }
  targetLabel.textContent = `Objectif: ${env.TARGET_SCORE}`;
}

function updateDifficultyLabel() {
  if (!difficultyLabel) return;
  difficultyLabel.textContent = `Mode: ${state.mode === 'easy' ? 'facile' : 'difficile'}`;
}

function updateFullscreenLabel() {
  if (!fullscreenBtn) return;
  const isFullscreen = Boolean(document.fullscreenElement);
  fullscreenBtn.textContent = isFullscreen ? 'Quitter plein écran' : 'Plein écran';
}

async function toggleFullscreen() {
  if (!fullscreenBtn) return;
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.warn('Impossible de basculer en plein écran.', error);
  }
}

function setModeFeedback(message, warning = false) {
  if (!modeFeedback) return;
  modeFeedback.textContent = message;
  modeFeedback.classList.toggle('warning', warning);
}

function maybeShowDifficultyMenu() {
  if (!difficultyMenu) return;
  if (state.attempts >= 3) {
    difficultyMenu.classList.remove('hidden');
  } else {
    difficultyMenu.classList.add('hidden');
  }
}

function handleDifficultySelection(choice) {
  if (choice === 'easy' && state.easyRequestCount === 0) {
    state.easyRequestCount += 1;
    setModeFeedback('Haha ptit zizi, 🤏 🤏 🤏 !', true);
    state.mode = 'difficult';
  } else {
    state.mode = choice;
    setModeFeedback(choice === 'easy' ? 'Mode facile activé.' : 'Mode difficile activé.', false);
  }
  updateDifficultyLabel();
}

function resetGame() {
  state.running = false;
  state.gameOver = false;
  state.victory = false;
  state.score = 0;
  state.speed = state.baseSpeed;
  state.distance = 0;
  state.obstacles = [];
  state.clouds = [{ x: 280, y: 30 }, { x: 520, y: 45 }];
  state.nextObstacleAt = 1200;
  state.dino.y = getCanvasHeight() - 24 - state.dino.height;
  state.dino.velY = 0;
  state.dino.grounded = true;
  state.dino.frameIndex = 0;
  state.dino.frameTime = 0;
  overlayTitle.textContent = "Go Go Hugo !";
  overlayText.textContent = "Comme d'hab, tu n'arriveras pas à tenir 30s ! Montre nous que tu tiens plus que ton âge.";
  startBtn.textContent = 'Jouer';
  overlay.classList.remove('hidden');
  updateDifficultyLabel();
  maybeShowDifficultyMenu();
  drawFrame();
}

function startGame() {
  state.running = true;
  state.lastTime = performance.now();
  overlay.classList.add('hidden');
  requestAnimationFrame(loop);
}

function endGame(victory) {
  state.running = false;
  state.gameOver = !victory;
  state.victory = victory;
  state.attempts += 1;
  overlay.classList.remove('hidden');
  updateDifficultyLabel();
  maybeShowDifficultyMenu();
  if (victory) {
    overlayTitle.textContent = 'Félicitations !';
    overlayText.textContent = `La lettre secrète est le "O" !`;
    startBtn.textContent = 'Rejouer';
  } else {
    overlayTitle.textContent = 'Oh non, Hugo s\'est fait poutrer !';
    overlayText.textContent = `Score final : ${Math.floor(state.score)}. Appuyez pour recommencer.`;
    startBtn.textContent = 'Recommencer';
  }
}

function spawnObstacle() {
  const groundY = getCanvasHeight() - 24;
  const easyMode = state.mode === 'easy';
  const difficultyScore = Math.min(state.score, easyMode ? 10 : 18);
  const isBird = !easyMode && state.score >= 10 && Math.random() < 0.72;

  if (isBird) {
    const height = 22;
    const width = 36;
    const y = groundY - 70 - Math.random() * 28;
    state.obstacles.push({
      x: getCanvasWidth() + 20,
      y,
      width,
      height,
      type: 'bird',
    });
  } else {
    const height = 28 + Math.random() * 34;
    const width = 18 + Math.random() * 16;
    state.obstacles.push({
      x: getCanvasWidth() + 20,
      y: groundY - height,
      width,
      height,
      type: 'block',
    });
  }

  const gapReduction = easyMode ? Math.min(difficultyScore * 6, 220) : Math.min(difficultyScore * 10, 380);
  const minGap = easyMode ? 50 : 28;
  const gapBase = easyMode ? 1100 : 1000;
  const gap = Math.max(minGap, gapBase - gapReduction + Math.random() * 360 + (easyMode ? 60 : 0));
  state.nextObstacleAt = state.distance + gap;
}

function jump() {
  if (state.gameOver || state.victory) return;
  if (!state.running) {
    startGame();
  }
  if (state.dino.grounded) {
    state.dino.velY = -state.dino.jumpPower;
    state.dino.grounded = false;
  }
}

function loop(timestamp) {
  if (!state.running) return;
  const elapsedSeconds = (timestamp - state.lastTime) / 1000;
  state.lastTime = timestamp;
  update(elapsedSeconds);
  drawFrame();
  if (!state.running) return;
  requestAnimationFrame(loop);
}

function update(seconds) {
  state.score += seconds;
  const delta = seconds * 60;
  state.distance += state.speed * delta;
  const easyMode = state.mode === 'easy';
  const difficultyScore = Math.min(state.score, easyMode ? 10 : 18);
  const speedBoost = Math.min(Math.floor(difficultyScore * (easyMode ? 0.45 : 0.55)), 10);
  const hardModeBoost = !easyMode && difficultyScore >= 10 ? Math.min(Math.floor((difficultyScore - 10) * 0.7), 8) : 0;
  state.speed = state.baseSpeed + speedBoost + hardModeBoost;
  if (state.score >= env.TARGET_SCORE && !state.victory) {
    endGame(true);
    return;
  }
  const spriteSpeed = state.dino.grounded ? 0.12 : 0.18;
  state.dino.frameTime += seconds;
  if (state.dino.frameTime > spriteSpeed) {
    state.dino.frameTime = 0;
    state.dino.frameIndex = (state.dino.frameIndex + 1) % 4;
  }

  while (state.distance > state.nextObstacleAt) spawnObstacle();
  if (Math.random() < 0.01 * delta) {
    state.clouds.push({ x: getCanvasWidth() + 40, y: 20 + Math.random() * 60 });
  }

  state.clouds = state.clouds.filter((cloud) => {
    cloud.x -= state.speed * 0.35 * delta;
    return cloud.x > -80;
  });

  state.obstacles = state.obstacles.filter((obs) => {
    obs.x -= state.speed * delta;
    return obs.x > -100;
  });

  state.dino.velY += state.dino.gravity * delta;
  state.dino.y += state.dino.velY * delta;
  const groundY = getCanvasHeight() - 24;
  if (state.dino.y >= groundY - state.dino.height) {
    state.dino.y = groundY - state.dino.height;
    state.dino.velY = 0;
    state.dino.grounded = true;
  }

  for (const obs of state.obstacles) {
    if (collides(state.dino, obs)) {
      endGame(false);
      return;
    }
  }

  scoreLabel.textContent = `Score: ${Math.floor(state.score)}`;
}

function collides(dino, obs) {
  const dinoBox = {
    x: dino.x + 4,
    y: dino.y + 8,
    width: dino.width - 8,
    height: dino.height - 8,
  };
  const obsBox = {
    x: obs.x,
    y: obs.y,
    width: obs.width,
    height: obs.height,
  };
  return (
    dinoBox.x < obsBox.x + obsBox.width &&
    dinoBox.x + dinoBox.width > obsBox.x &&
    dinoBox.y < obsBox.y + obsBox.height &&
    dinoBox.y + dinoBox.height > obsBox.y
  );
}

function drawFrame() {
  const width = getCanvasWidth();
  const height = getCanvasHeight();
  const theme = getTheme();
  ctx.clearRect(0, 0, width, height);
  drawSky(width, height, theme);
  drawGround(width, height, theme);
  drawClouds(theme);
  drawObstacles(theme);
  drawDino(theme);
  if (!state.running) drawStartHint(width, height, theme);
  // clignotement après 25s : masquer / afficher le canvas
  if (state.score >= 25) {
    const blinkOn = Math.sin(state.score * 6) > 0;
    canvas.style.visibility = blinkOn ? 'visible' : 'hidden';
  } else {
    canvas.style.visibility = 'visible';
  }
}

function drawSky(width, height, theme) {
  ctx.fillStyle = theme.sky;
  ctx.fillRect(0, 0, width, height);
}

function drawGround(width, height, theme) {
  const y = height - 24;
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, y, width, 4);
  ctx.fillStyle = theme.groundLine;
  for (let i = 0; i < width; i += 24) {
    ctx.fillRect(i + (state.distance / 12 % 24), y, 12, 4);
  }
}

function drawClouds(theme) {
  ctx.fillStyle = theme.cloud;
  state.clouds.forEach((cloud) => {
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, 10, 0, Math.PI * 2);
    ctx.arc(cloud.x + 14, cloud.y + 2, 13, 0, Math.PI * 2);
    ctx.arc(cloud.x + 28, cloud.y, 10, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawRoundedRect(rx, ry, rw, rh, rr) {
  const r = Math.min(rr, rw / 2, rh / 2);
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.lineTo(rx + rw - r, ry);
  ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + r);
  ctx.lineTo(rx + rw, ry + rh);
  ctx.lineTo(rx, ry + rh);
  ctx.lineTo(rx, ry + r);
  ctx.quadraticCurveTo(rx, ry, rx + r, ry);
  ctx.closePath();
  ctx.fill();
}

function drawObstacles(theme) {
  state.obstacles.forEach((obs) => {
    if (obs.type === 'bird') {
      const y = obs.y;
      ctx.fillStyle = theme.obstacleAccent;
      ctx.beginPath();
      ctx.arc(obs.x + obs.width * 0.25, y + obs.height * 0.4, 6, 0, Math.PI * 2);
      ctx.arc(obs.x + obs.width * 0.75, y + obs.height * 0.4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.obstacle;
      ctx.beginPath();
      ctx.moveTo(obs.x + 4, y + obs.height * 0.5);
      ctx.quadraticCurveTo(obs.x + obs.width * 0.25, y + obs.height * 0.1, obs.x + obs.width * 0.5, y + obs.height * 0.5);
      ctx.quadraticCurveTo(obs.x + obs.width * 0.75, y + obs.height * 0.9, obs.x + obs.width - 4, y + obs.height * 0.5);
      ctx.lineTo(obs.x + obs.width * 0.75, y + obs.height * 0.45);
      ctx.quadraticCurveTo(obs.x + obs.width * 0.65, y + obs.height * 0.15, obs.x + obs.width * 0.5, y + obs.height * 0.35);
      ctx.quadraticCurveTo(obs.x + obs.width * 0.35, y + obs.height * 0.15, obs.x + obs.width * 0.25, y + obs.height * 0.45);
      ctx.closePath();
      ctx.fill();
      return;
    }

    ctx.fillStyle = theme.obstacle;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

    const baseSquareSize = 20;
    const baseSquareY = obs.y + obs.height - baseSquareSize;
    const baseRadius = 6;
    ctx.fillStyle = theme.obstacleAccent;
    drawRoundedRect(obs.x - 15, baseSquareY, baseSquareSize, baseSquareSize, baseRadius);
    drawRoundedRect(obs.x + obs.width - baseSquareSize + 15, baseSquareY, baseSquareSize, baseSquareSize, baseRadius);
    ctx.fillStyle = theme.obstacle;

    const topSquareSize = obs.width + 8;
    const topSquareX = obs.x - 4;
    const topSquareY = obs.y - topSquareSize + 20;
    const topSquareW = topSquareSize;
    const topSquareH = topSquareSize - topSquareSize * 0.3;
    const radius = Math.min(8, topSquareH / 2, topSquareW / 2);
    ctx.beginPath();
    ctx.moveTo(topSquareX, topSquareY + radius);
    ctx.quadraticCurveTo(topSquareX, topSquareY, topSquareX + radius, topSquareY);
    ctx.lineTo(topSquareX + topSquareW - radius, topSquareY);
    ctx.quadraticCurveTo(topSquareX + topSquareW, topSquareY, topSquareX + topSquareW, topSquareY + radius);
    ctx.lineTo(topSquareX + topSquareW, topSquareY + topSquareH);
    ctx.lineTo(topSquareX, topSquareY + topSquareH);
    ctx.closePath();
    ctx.fill();
  });
}

function drawDino(theme) {
  const d = state.dino;
  const sourceSet = state.dino.grounded ? (state.running ? 'run' : 'idle') : 'jump';
  const frame = state.dino.spriteSets[sourceSet][state.dino.frameIndex];
  if (sprite.complete && frame) {
    ctx.drawImage(sprite, frame.x, frame.y, frame.w, frame.h, d.x, d.y, d.width, d.height);
    return;
  }
  ctx.fillStyle = theme.dinoFill;
  ctx.fillRect(d.x, d.y, d.width, d.height);
  ctx.fillStyle = theme.dinoEye;
  ctx.fillRect(d.x + 8, d.y + 10, 8, 8);
  ctx.fillRect(d.x + 28, d.y + 8, 8, 8);
  const legOffset = Math.sin(state.score / 7) * 4;
  ctx.fillRect(d.x + 8, d.y + d.height - 5, 10, 5);
  ctx.fillRect(d.x + 26, d.y + d.height - 5 + (state.dino.grounded ? legOffset : 0), 10, 5);
}

function drawStartHint(width, height, theme) {
  ctx.fillStyle = theme.hintBg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = theme.hintText;
  ctx.font = '600 18px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Touchez l’écran ou appuyez sur ESPACE pour commencer', width / 2, height / 2 + 8);
}

// drawBlink removed: blinking now toggles canvas visibility in drawFrame

window.addEventListener('resize', () => {
  setupCanvas();
  drawFrame();
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    event.preventDefault();
    jump();
  }
});

canvas.addEventListener('pointerdown', () => jump());
startBtn.addEventListener('click', () => {
  if (state.gameOver || state.victory) resetGame();
  startGame();
});

easyBtn.addEventListener('click', () => handleDifficultySelection('easy'));
hardBtn.addEventListener('click', () => handleDifficultySelection('difficult'));
if (fullscreenBtn) {
  fullscreenBtn.addEventListener('click', toggleFullscreen);
}
window.addEventListener('fullscreenchange', () => {
  updateFullscreenLabel();
  setupCanvas();
  drawFrame();
});

document.addEventListener('DOMContentLoaded', async () => {
  setupCanvas();
  await loadEnv();
  updateFullscreenLabel();
  resetGame();
});
