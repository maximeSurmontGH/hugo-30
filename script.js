const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreLabel = document.getElementById('score');
const targetLabel = document.getElementById('target');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const startBtn = document.getElementById('startBtn');

const sprite = new Image();
sprite.src = 'sprit.png';
sprite.onload = () => drawFrame();

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
};

const getCanvasWidth = () => Math.min(860, window.innerWidth - 16);
const getCanvasHeight = () => 180;

function setupCanvas() {
  canvas.width = getCanvasWidth() * window.devicePixelRatio;
  canvas.height = getCanvasHeight() * window.devicePixelRatio;
  canvas.style.height = `${getCanvasHeight()}px`;
  canvas.style.width = `${getCanvasWidth()}px`;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function parseEnv(data) {
  data.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, value] = trimmed.split('=');
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
  state.dino.y = 92;
  state.dino.velY = 0;
  state.dino.grounded = true;
  state.dino.frameIndex = 0;
  state.dino.frameTime = 0;
  overlayTitle.textContent = "Comme d'hab, tu n'arriveras pas à tenir 30s !";
  overlayText.textContent = 'Montre nous que tu tiens plus que ton âge.';
  startBtn.textContent = 'Jouer';
  overlay.classList.remove('hidden');
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
  overlay.classList.remove('hidden');
  if (victory) {
    overlayTitle.textContent = 'Félicitations !';
    overlayText.textContent = `Lettre secrète le "O". Score final : ${Math.floor(state.score)}`;
    startBtn.textContent = 'Rejouer';
  } else {
    overlayTitle.textContent = 'T-Rex écrasé';
    overlayText.textContent = `Score final : ${Math.floor(state.score)}. Appuyez pour recommencer.`;
    startBtn.textContent = 'Recommencer';
  }
}

function spawnObstacle() {
  const height = 28 + Math.random() * 34;
  const width = 18 + Math.random() * 16;
  state.obstacles.push({
    x: getCanvasWidth() + 20,
    y: getCanvasHeight() - 30 - height,
    width,
    height,
  });
  const gapReduction = Math.min(state.score * 8, 320);
  state.nextObstacleAt = state.distance + 1000 - gapReduction + Math.random() * 360;
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
  const speedBoost = Math.min(Math.floor(state.score * 0.55), 10);
  state.speed = state.baseSpeed + speedBoost;
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

  if (state.distance > state.nextObstacleAt) spawnObstacle();
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
  if (state.dino.y >= 92) {
    state.dino.y = 92;
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
  ctx.clearRect(0, 0, width, height);
  drawSky(width, height);
  drawGround(width, height);
  drawClouds();
  drawObstacles();
  drawDino();
  if (!state.running) drawStartHint(width, height);
}

function drawSky(width, height) {
  ctx.fillStyle = '#f3f3f3';
  ctx.fillRect(0, 0, width, height);
}

function drawGround(width, height) {
  const y = height - 24;
  ctx.fillStyle = '#555';
  ctx.fillRect(0, y, width, 4);
  ctx.fillStyle = '#cfcfcf';
  for (let i = 0; i < width; i += 24) {
    ctx.fillRect(i + (state.distance / 12 % 24), y, 12, 4);
  }
}

function drawClouds() {
  ctx.fillStyle = '#ececec';
  state.clouds.forEach((cloud) => {
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, 10, 0, Math.PI * 2);
    ctx.arc(cloud.x + 14, cloud.y + 2, 13, 0, Math.PI * 2);
    ctx.arc(cloud.x + 28, cloud.y, 10, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawObstacles() {
  ctx.fillStyle = '#333';
  state.obstacles.forEach((obs) => {
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    ctx.fillRect(obs.x + 4, obs.y - 6, 6, 6);
    ctx.fillRect(obs.x + obs.width - 12, obs.y - 10, 6, 10);
  });
}

function drawDino() {
  const d = state.dino;
  const sourceSet = state.dino.grounded ? (state.running ? 'run' : 'idle') : 'jump';
  const frame = state.dino.spriteSets[sourceSet][state.dino.frameIndex];
  if (sprite.complete && frame) {
    ctx.drawImage(sprite, frame.x, frame.y, frame.w, frame.h, d.x, d.y, d.width, d.height);
    return;
  }
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(d.x, d.y, d.width, d.height);
  ctx.fillStyle = '#f7f7f7';
  ctx.fillRect(d.x + 8, d.y + 10, 8, 8);
  ctx.fillRect(d.x + 28, d.y + 8, 8, 8);
  const legOffset = Math.sin(state.score / 7) * 4;
  ctx.fillRect(d.x + 8, d.y + d.height - 5, 10, 5);
  ctx.fillRect(d.x + 26, d.y + d.height - 5 + (state.dino.grounded ? legOffset : 0), 10, 5);
}

function drawStartHint(width, height) {
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#333';
  ctx.font = '600 18px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Touchez l’écran ou appuyez sur ESPACE pour commencer', width / 2, height / 2 + 8);
}

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

document.addEventListener('DOMContentLoaded', async () => {
  setupCanvas();
  await loadEnv();
  resetGame();
});
