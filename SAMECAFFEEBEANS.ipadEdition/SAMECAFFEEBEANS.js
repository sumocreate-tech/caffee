let recentScores = JSON.parse(localStorage.getItem("recentScores")) || [];

//--------------------------------------------------
// ▼ ゲーム関連変数
//--------------------------------------------------
let score = 0;
let gameOver = false;

let gameState = "play";  // play, gameover, clear の3つ
const ROWS = 15;
const COLS = 23;
const BLOCK = 50;
const TYPES = 4;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let board = [];

//--------------------------------------------------
// 音関係
//--------------------------------------------------
const clearSound = new Audio("sounds/clearsound.mp3");
clearSound.volume = 1;

const startSound = new Audio("sounds/startsound.mp3")
startSound.volume = 1;

const bgm = new Audio("sounds/caffeegame.mp3");
bgm.loop = true;
bgm.volume = 0.3;

// スライダー
const bgmVolumeSlider = document.getElementById("bgmVolume");
const seVolumeSlider = document.getElementById("seVolume");

bgmVolumeSlider.addEventListener("input", () => {
  bgm.volume = Number(bgmVolumeSlider.value);
});

seVolumeSlider.addEventListener("input", () => {
  clearSound.volume = Number(seVolumeSlider.value);
});

//--------------------------------------------------
// 画像読み込み
//--------------------------------------------------
const imageFiles = [
  null,
  "beans_green.png",
  "beans_orange.png",
  "beans_brown.png",
  "beans_yellow.png"
];

let blockImages = [];

function startGame() {
  bgm.play();
  initBoard();
  drawBoard();
}

function loadImages() {
  return Promise.all(
    imageFiles.map((file) => {
      if (!file) return null;
      return new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = "images/" + file;
      });
    })
  );
}

//--------------------------------------------------
// 盤面生成
//--------------------------------------------------
function initBoard() {
  board = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => Math.floor(Math.random() * TYPES) + 1)
  );
}

//--------------------------------------------------
// 描画
//--------------------------------------------------
function drawBoard(custom = {}) {
  ctx.fillStyle = "#ffc000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell) {
        ctx.globalAlpha = custom.alphaMap?.[r]?.[c] ?? 1;
        const img = blockImages[cell];
        if (img) {
          ctx.drawImage(img, c * BLOCK, r * BLOCK, BLOCK, BLOCK);
        } else {
          ctx.fillStyle = ["#000000", "#6ea8fe", "#8bdc6b", "#b28b4a", "#ffdf6b"][cell];
          ctx.fillRect(c * BLOCK + 2, r * BLOCK + 2, BLOCK - 4, BLOCK - 4);
        }
      }
    }
  }

  ctx.globalAlpha = 1;
  drawScore();
}

function drawScore() {
  document.getElementById("scoreboardText").textContent = "Score: " + score;
}

//--------------------------------------------------
// マッチ判定
//--------------------------------------------------
function findMatchesAt(r, c) {
  const type = board[r]?.[c];
  if (!type) return [];

  let visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  let queue = [[r, c]];
  let group = [];

  while (queue.length) {
    const [y, x] = queue.pop();
    if (visited[y][x]) continue;
    visited[y][x] = true;
    if (board[y][x] !== type) continue;
    group.push([y, x]);

    for (const [dy, dx] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const ny = y + dy, nx = x + dx;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        if (!visited[ny][nx] && board[ny][nx] === type) queue.push([ny, nx]);
      }
    }
  }
  return group.length >= 2 ? group : [];
}

//--------------------------------------------------
// マッチ存在確認
//--------------------------------------------------
function checkMatchesExist() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const type = board[r][c];
      if (!type) continue;
      if ((c < COLS - 1 && board[r][c + 1] === type) ||
          (r < ROWS - 1 && board[r + 1][c] === type)) return true;
    }
  }
  return false;
}

function checkGameOver() {
  const hasBlocks = board.flat().some(v => v !== 0);
  return !hasBlocks || !checkMatchesExist();
}

//--------------------------------------------------
// アニメーション
//--------------------------------------------------
function animateClear(matches) {
  let alphaMap = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
  let step = 0;

  return new Promise(resolve => {
    function frame() {
      step += 0.1;
      const alpha = Math.max(1 - step, 0);
      matches.forEach(([r, c]) => alphaMap[r][c] = alpha);

      drawBoard({ alphaMap });

      if (alpha > 0) requestAnimationFrame(frame);
      else resolve();
    }
    frame();
  });
}

async function animateFall() {
  let moved;
  do {
    moved = false;
    for (let r = ROWS - 2; r >= 0; r--) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c] && board[r + 1][c] === 0) {
          board[r + 1][c] = board[r][c];
          board[r][c] = 0;
          moved = true;
        }
      }
    }
    drawBoard();
    await wait(20);
  } while (moved);
}

async function animateShiftLeft() {
  let moved;
  do {
    moved = false;
    for (let c = 0; c < COLS - 1; c++) {
      let empty = true;
      for (let r = 0; r < ROWS; r++) {
        if (board[r][c] !== 0) { empty = false; break; }
      }
      if (empty) {
        for (let r = 0; r < ROWS; r++) {
          board[r][c] = board[r][c + 1];
          board[r][c + 1] = 0;
        }
        moved = true;
      }
    }
    drawBoard();
    await wait(20);
  } while (moved);
}

function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

//--------------------------------------------------
// ▼クリック処理（スコア保存はここではしない）
//--------------------------------------------------
async function handleClick(e) {
  if (gameOver) return;

  const rect = canvas.getBoundingClientRect();
  
  // iPadの縮小表示に対応した座標計算
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  // マウスとタッチの両方の座標取得に対応
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);

  const x = Math.floor((clientX - rect.left) * scaleX / BLOCK);
  const y = Math.floor((clientY - rect.top) * scaleY / BLOCK);
  
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;

  const matches = findMatchesAt(y, x);
  if (matches.length === 0) return;

  let count = matches.length;
  if (count >= 2) {
    score += 20 + (count - 2) * 40;
  }

  await animateClear(matches);

  clearSound.currentTime = 0;
  clearSound.play();

  matches.forEach(([r, c]) => board[r][c] = 0);

  await animateFall();
  await animateShiftLeft();
  drawBoard();

  if (checkGameOver()) showGameOver();
}

//--------------------------------------------------
// ▼スコア保存（localStorage）
//--------------------------------------------------
function saveRecentScore(s) {
  recentScores.push(s);
  recentScores.sort((a, b) => b - a);
  recentScores = recentScores.slice(0, 9);

  localStorage.setItem("recentScores", JSON.stringify(recentScores));

  updateScoreList();
}

//--------------------------------------------------
// ▼スコアリスト更新
//--------------------------------------------------
function updateScoreList() {
  const list = document.getElementById("scoreList");
  list.innerHTML = "";
  recentScores.forEach((v, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1} ${v}`;
    list.appendChild(li);
  });
}

// 初期読み込み時にスコア表示
updateScoreList();

//--------------------------------------------------
// ゲームオーバー
//--------------------------------------------------
function showGameOver() {
  gameOver = true;
  document.getElementById("gameOverOverlay").style.display = "block";
  saveRecentScore(score);
}

//--------------------------------------------------
// クリア
//--------------------------------------------------
function showClearOverlay() {
  document.getElementById("clearOverlay").style.display = "block";
}

function hideClearOverlay() {
  document.getElementById("clearOverlay").style.display = "none";
}

function clearBoard() {
  if (gameOver) return;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      board[r][c] = 0;
    }
  }

  drawBoard();

  gameOver = true;
  showClearOverlay();
  saveRecentScore(score);
}

//--------------------------------------------------
// Restart
//--------------------------------------------------
function restartGame() {
  score = 0;
  gameOver = false;
  initBoard();
  drawBoard();
  document.getElementById("gameOverOverlay").style.display = "none";
  document.getElementById("clearOverlay").style.display = "none";
  startSound.play();
}

document.getElementById("restartBtn").addEventListener("click", restartGame);
canvas.addEventListener("pointerdown", handleClick);

//--------------------------------------------------
// 自動ゲームオーバー
//--------------------------------------------------
setInterval(() => {
  if (!gameOver && checkGameOver()) showGameOver();
}, 500);

//--------------------------------------------------
// Start
//--------------------------------------------------
document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("startOverlay").style.display = "none";
  bgm.play();
  startSound.currentTime = 0;
  startSound.play();
  startGame();
});

//--------------------------------------------------
// 初期化処理
//--------------------------------------------------
loadImages().then(images => {
  blockImages = images;
  initBoard();
  drawBoard();
});
