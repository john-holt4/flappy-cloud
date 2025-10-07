const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function getClouds() {
  const w = canvas.width;
  const h = canvas.height;
  return [
    { cx: w * 0.15, cy: h * 0.18, rx: w * 0.09, ry: h * 0.04, speed: 0.06, opacity: 0.5, direction: 1 },
    { cx: w * 0.32, cy: h * 0.12, rx: w * 0.07, ry: h * 0.03, speed: 0.04, opacity: 0.4, direction: -1 },
    { cx: w * 0.62, cy: h * 0.16, rx: w * 0.11, ry: h * 0.05, speed: 0.05, opacity: 0.5, direction: 1 },
    { cx: w * 0.88, cy: h * 0.09, rx: w * 0.08, ry: h * 0.03, speed: 0.03, opacity: 0.4, direction: -1 },
    { cx: w * 0.45, cy: h * 0.08, rx: w * 0.05, ry: h * 0.02, speed: 0.07, opacity: 0.3, direction: 1 }
  ];
}

let clouds = [];
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  clouds = getClouds();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let y = canvas.height / 2,
  v = 0,
  score = 0,
  running = false,
  started = false,
  playerName = '',
  sessionId = null;

const birdX = canvas.width / 4;
const BASE_HEIGHT = 900;
const BASE_START_GAP = 220;
const startGap = BASE_START_GAP;
const minPipeGap = 80;
const startPipeDistance = 420;
const minPipeDistance = 90;
let gravity = 0.32;
let jump = -6.2;
let birdSpeed = 2.7;

let pipes = [];
const pipeWidth = 80;

function getDifficultyLevel() {
  return Math.floor(score / 500);
}
function getCurrentGap() {
  const effectiveH = Math.min(canvas.height, BASE_HEIGHT);
  const basePct = BASE_START_GAP / BASE_HEIGHT;
  const level = getDifficultyLevel();
  const raw = (effectiveH * basePct) - level * 12;
  return Math.max(minPipeGap, raw);
}
function getCurrentDistance() {
  return Math.max(minPipeDistance, startPipeDistance - getDifficultyLevel() * 20);
}
function getCurrentGravity() {
  return Math.min(0.7, 0.25 + getDifficultyLevel() * 0.015);
}
function getCurrentJump() {
  return Math.max(-10, -5.5 - getDifficultyLevel() * 0.15);
}
function getCurrentBirdSpeed() {
  return 2.7 + getDifficultyLevel() * 0.12;
}
function resetPipes() {
  pipes = [];
  const dist = getCurrentDistance();
  const gapValue = getCurrentGap();
  const level = getDifficultyLevel();
  const numPipes = Math.ceil(canvas.width / dist) + 2;
  const firstPipeX = birdX + 340;
  let lastGapY = null;
  const maxDeltaY = window.innerWidth > 600 ? 440 : canvas.height;
  for (let i = 0; i < numPipes; i++) {
    const x = firstPipeX + i * dist;
    let gapY;
    if (i === 0) {
      gapY = canvas.height / 2;
    } else {
      const minY = 80, maxY = canvas.height - 80;
      let tryCount = 0;
      do {
        gapY = minY + Math.random() * (maxY - minY);
        tryCount++;
      } while (
        lastGapY !== null &&
        window.innerWidth > 600 &&
        Math.abs(gapY - lastGapY) > maxDeltaY &&
        tryCount < 10
      );
    }
    lastGapY = gapY;
    pipes.push({ x, gapY, gap: gapValue, dist, level });
  }
}

const birdImg = new Image();
birdImg.src = '/static/cloud.png';
const birdWidth = 84;
const birdHeight = 38;

function drawClouds(ctx) {
  for (const cloud of clouds) {
    ctx.save();
    ctx.globalAlpha = cloud.opacity;
        
        drawRoundedRect(ctx, cloud.cx - cloud.rx, cloud.cy - cloud.ry, cloud.rx * 2, cloud.ry * 1.3, 16);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.restore();
      }
    }
    
    function drawRoundedRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
    function draw() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      
      drawClouds(ctx);
      
      for (const pipe of pipes) {
        
        ctx.fillStyle = '#17651c'; 
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.gapY - pipe.gap/2);
        ctx.fillRect(pipe.x, pipe.gapY + pipe.gap/2, pipeWidth, canvas.height - (pipe.gapY + pipe.gap/2));
        
        ctx.fillStyle = '#114a15';
        ctx.fillRect(pipe.x - 6, (pipe.gapY - pipe.gap/2) - 18, pipeWidth + 12, 18);
        
        ctx.fillStyle = '#114a15';
        ctx.fillRect(pipe.x - 6, (pipe.gapY + pipe.gap/2), pipeWidth + 12, 18);
        
        ctx.fillStyle = 'rgba(255,255,255,0.13)';
        ctx.fillRect(pipe.x + 8, 0, 8, pipe.gapY - pipe.gap/2);
        ctx.fillRect(pipe.x + 8, pipe.gapY + pipe.gap/2, 8, canvas.height - (pipe.gapY + pipe.gap/2));
      }
  
  ctx.drawImage(birdImg, birdX - birdWidth/2, y - birdHeight/2, birdWidth, birdHeight);
      
      const scoreDiv = document.getElementById('scoreOSD');
      if (running) {
        scoreDiv.textContent = 'Score: ' + score;
        scoreDiv.style.display = 'block';
      } else {
        scoreDiv.style.display = 'none';
      }
    }
    function collides() {
      
      const margin = 6;
      const birdLeft = birdX - birdWidth/2 + margin;
      const birdRight = birdX + birdWidth/2 - margin;
      const birdTop = y - birdHeight/2 + margin;
      const birdBottom = y + birdHeight/2 - margin;
      for (const pipe of pipes) {
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + pipeWidth;
        const gapTop = pipe.gapY - pipe.gap/2;
        const gapBottom = pipe.gapY + pipe.gap/2;
        
        if (birdRight > pipeLeft && birdLeft < pipeRight) {
          
          if (birdTop < gapTop || birdBottom > gapBottom) {
            return true;
          }
        }
      }
      return false;
    }
    
    function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
      
      let closestX = Math.max(rx, Math.min(cx, rx + rw));
      let closestY = Math.max(ry, Math.min(cy, ry + rh));
      let dx = cx - closestX;
      let dy = cy - closestY;
      return (dx * dx + dy * dy) < (cr * cr);
    }
    function update() {
      if (!running) return;
      gravity = getCurrentGravity();
      jump = getCurrentJump();
      birdSpeed = getCurrentBirdSpeed();
      y += v; v += gravity;
      updateClouds();
      
      for (const pipe of pipes) {
        pipe.x -= birdSpeed;
      }
      
      if (pipes.length && pipes[0].x < -pipeWidth) {
        pipes.shift();
  let level = getDifficultyLevel();
  let dist = getCurrentDistance();
  let gap = getCurrentGap();
        let lastX = pipes[pipes.length-1].x;
        let lastGapY = pipes[pipes.length-1].gapY;
        let minY = 80, maxY = canvas.height - 80;
          let maxDeltaY = (window.innerWidth > 600) ? 440 : canvas.height; 
        let gapY, tryCount = 0;
        do {
          gapY = minY + Math.random() * (maxY - minY);
          tryCount++;
        } while (window.innerWidth > 600 && Math.abs(gapY - lastGapY) > maxDeltaY && tryCount < 10);
        pipes.push({ x: lastX + dist, gapY, gap, dist, level });
      }
      if (y > canvas.height - 30 || y < 0 || collides()) {
        
        vibratePhone();
        running = false;
        showGameOver();
        submitScore();
        showLeaderboard();
        return;
      }
      draw();
      requestAnimationFrame(update);
    }
      let lastFrameTime = null;
      function update(now) {
        if (!running) return;
        if (!lastFrameTime) lastFrameTime = now;
        let dt = Math.min((now - lastFrameTime) / 1000, 0.04); 
        lastFrameTime = now;

        
        v += gravity * dt * 60;
        y += v * dt * 60;
        
        for (const pipe of pipes) {
          pipe.x -= birdSpeed * dt * 60;
        }
        
        if (pipes.length && pipes[0].x < -pipeWidth) {
          pipes.shift();
          let level = getDifficultyLevel();
          let dist = getCurrentDistance();
          let gap = getCurrentGap();
          let lastX = pipes[pipes.length-1].x;
          let lastGapY = pipes[pipes.length-1].gapY;
          let minY = 80, maxY = canvas.height - 80;
          let maxDeltaY = (window.innerWidth > 600) ? 440 : canvas.height;
          let gapY, tryCount = 0;
          do {
            gapY = minY + Math.random() * (maxY - minY);
            tryCount++;
          } while (window.innerWidth > 600 && Math.abs(gapY - lastGapY) > maxDeltaY && tryCount < 10);
          pipes.push({ x: lastX + dist, gapY, gap, dist, level });
        }
        if (y > canvas.height - 30 || y < 0 || collides()) {
          vibratePhone();
          running = false;
          showGameOver();
          submitScore();
          showLeaderboard();
          lastFrameTime = null;
          return;
        }
        if (!window._scoreTime) window._scoreTime = 0;
        window._scoreTime += dt * 60;
        if (window._scoreTime >= 1) {
          score += Math.floor(window._scoreTime);
          window._scoreTime -= Math.floor(window._scoreTime);
        }
        draw();
        requestAnimationFrame(update);
      }
    let startViewport = null;
    async function startGame() {
      playerName = document.getElementById('name').value.trim() || 'anon';
      y = canvas.height/2; v = 0; score = 0; running = false; started = true;
      window._voidedRun = false;
      startViewport = {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio || 1
      };
      resetPipes();
      document.getElementById('startScreen').style.display = 'none';
      document.getElementById('restartBtn').style.display = 'none';
      document.getElementById('finalScore').style.display = 'none';
      document.getElementById('leaderboard').style.display = 'none';
      draw();
      showCountdownAndStart();
    }
      lastFrameTime = null;

    
  function showCountdownAndStart() {
      let countdownDiv = document.createElement('div');
      countdownDiv.id = 'countdownOverlay';
      countdownDiv.style.position = 'fixed';
      countdownDiv.style.left = '0';
      countdownDiv.style.top = '0';
      countdownDiv.style.width = '100vw';
      countdownDiv.style.height = '100vh';
      countdownDiv.style.display = 'flex';
      countdownDiv.style.alignItems = 'center';
      countdownDiv.style.justifyContent = 'center';
      countdownDiv.style.zIndex = '100';
      countdownDiv.style.background = 'none';
      countdownDiv.style.color = '#fff';
      countdownDiv.style.fontSize = '6em';
      countdownDiv.style.fontFamily = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif';
      countdownDiv.style.textShadow = '2px 2px 0 #404041, 0 0 8px #404041aa';
      document.body.appendChild(countdownDiv);
      
      let count = 3;
      countdownDiv.textContent = count;
      let countdownActive = true;
      function renderCountdown() {
  if (!countdownActive) return;
  draw(); 
  requestAnimationFrame(renderCountdown);
      }
      renderCountdown();
      let timer = setInterval(() => {
        if (count > 1) {
          count--;
          countdownDiv.textContent = count;
          
          if (window.navigator && navigator.vibrate && (count === 3 || count === 2 || count === 1)) {
            navigator.vibrate([100, 50, 100]);
          }
        } else {
          clearInterval(timer);
          countdownActive = false;
          document.body.removeChild(countdownDiv);
          // create session right when actual gameplay starts (after countdown)
          (async () => {
            try {
              const resp = await fetch('/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(startViewport || {})
              });
              const js = await resp.json();
              sessionId = js.session_id;
            } catch (e) {
              console.error('Failed to create session', e);
              sessionId = null;
            }
            running = true;
            requestAnimationFrame(update);
          })();
        }
      }, 1000);
    }
    canvas.onclick = () => {
      if (!started) return;
      if (!running) return;
      v = jump;
      vibratePhone();
    };

    
    window.addEventListener('keydown', function(e) {
      if ((e.code === 'Space' || e.key === ' ') && started && running) {
        v = jump;
        e.preventDefault();
      }
    });
    
    document.getElementById('startScreen').onclick = function(e) {
      
      if (e.target.id === 'restartBtn') return;
      if (!started && document.getElementById('nameForm').style.display !== 'none') return;
    };
    
    function showNameForm() {
  document.getElementById('startScreen').style.display = 'flex';
  document.getElementById('restartBtn').style.display = 'none';
  document.getElementById('nameForm').style.display = 'flex';
  document.getElementById('welcomeMsg').style.display = 'block';
  document.getElementById('gameOverMsg').style.display = 'none';
  document.getElementById('finalScore').style.display = 'none';
  document.getElementById('leaderboard').style.display = 'none';
  document.getElementById('gameTitle').style.display = 'flex';
    }
    showNameForm();
    
    async function submitScore() {
      if (!playerName) return;
      if (window._voidedRun) return;
      const payload = {
        name: playerName,
        score,
        session_id: sessionId,
        viewport_w: window.innerWidth,
        viewport_h: window.innerHeight,
        dpr: window.devicePixelRatio || 1
      };
      try {
        const resp = await fetch('/api/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const text = await resp.text();
          console.warn('Score rejected', text);
        }
      } catch (e) {
        console.error('Score submit error', e);
      }
    }
    async function showLeaderboard() {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      let html = '<h2>Leaderboard</h2><ol>';
      for (const [name, score] of data) {
        html += `<li>${name}: ${score}</li>`;
      }
      html += '</ol>';
      document.getElementById('leaderboard').innerHTML = html;
    }
    function showGameOver() {
      started = false;
  document.getElementById('startScreen').style.display = 'flex';
  document.getElementById('restartBtn').style.display = 'inline-block';
  document.getElementById('nameForm').style.display = 'none';
  document.getElementById('welcomeMsg').style.display = 'none';
  document.getElementById('gameOverMsg').style.display = 'block';
  document.getElementById('finalScore').textContent = 'Score: ' + score;
  document.getElementById('finalScore').style.display = 'block';
  document.getElementById('leaderboard').style.display = 'block';
  document.getElementById('gameTitle').style.display = 'none';
  document.getElementById('aiCommentary').style.display = 'block';
  showAICommentary(score, playerName);
    }
    document.getElementById('restartBtn').onclick = function() {
      document.getElementById('nameForm').style.display = 'none';
      document.getElementById('leaderboard').style.display = 'none';
      startGame();
    };
    
    document.getElementById('clouds-bg')?.remove();
    
    function updateClouds() {
      for (const cloud of clouds) {
        cloud.cx += cloud.speed * cloud.direction;
        if (cloud.direction === 1 && cloud.cx - cloud.rx > canvas.width) {
          
          cloud.cx = -cloud.rx;
        } else if (cloud.direction === -1 && cloud.cx + cloud.rx < 0) {
          
          cloud.cx = canvas.width + cloud.rx;
        }
      }
    }

    window.addEventListener('resize', () => {
      if (!running || !startViewport) return;
      const SHRINK_THRESHOLD = 0.85;
      const wOk = window.innerWidth >= startViewport.w * SHRINK_THRESHOLD;
      const hOk = window.innerHeight >= startViewport.h * SHRINK_THRESHOLD;
      const dprCurrent = window.devicePixelRatio || 1;
      const dprOk = dprCurrent >= (startViewport.dpr || 1) * SHRINK_THRESHOLD;
      if (!(wOk && hOk && dprOk)) {
        running = false;
        started = false;
        window._voidedRun = true;
        const msg = document.getElementById('gameOverMsg');
        if (msg) msg.textContent = 'Run voided (resize/zoom detected)';
        document.getElementById('finalScore').style.display = 'none';
        document.getElementById('restartBtn').style.display = 'inline-block';
        document.getElementById('startScreen').style.display = 'flex';
      }
    });
    
    function vibratePhone() {
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }
      
      async function showAICommentary(score, playerName) {
        const aiCommentary = document.getElementById('aiCommentary');
        const aiCommentaryText = document.getElementById('aiCommentaryText');
        const aiPlayAgainBtn = document.getElementById('aiPlayAgainBtn');
        const aiLeaderboardBtn = document.getElementById('aiLeaderboardBtn');
        aiCommentary.style.display = 'block';
        aiCommentaryText.textContent = 'Cloudy AI Thinking...';
        document.getElementById('finalScore').style.display = 'none';
        document.getElementById('leaderboard').style.display = 'none';
        document.getElementById('restartBtn').style.display = 'none';
        try {
          const prompt = `Player ${playerName} scored ${score} points in a cloudflare themed game. Give a short, fun, and witty comment that integrates cloudflare produtcs.(max 15 words).`;
          const res = await fetch('/api/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
          });
          const data = await res.json();
          aiCommentaryText.innerHTML = (data.result || 'No response.') + '<br><span style="display:block;margin-top:0.5em;font-size:0.9em;font-style:italic;opacity:0.8;">- Cloudy AI</span>';
        } catch (e) {
          aiCommentaryText.textContent = 'Error: ' + e;
        }
        aiPlayAgainBtn.onclick = function() {
          aiCommentary.style.display = 'none';
          document.getElementById('leaderboard').style.display = 'none';
          document.getElementById('finalScore').style.display = 'none';
          document.getElementById('restartBtn').style.display = 'none';
          startGame();
        };
        aiLeaderboardBtn.onclick = function() {
          aiCommentary.style.display = 'none';
          document.getElementById('leaderboard').style.display = 'block';
          document.getElementById('finalScore').style.display = 'block';
          document.getElementById('restartBtn').style.display = 'inline-block';
        };
      }
      
    
      
      document.addEventListener('DOMContentLoaded', function() {
        const nameForm = document.getElementById('nameForm');
        if (nameForm) {
          const playBtn = nameForm.querySelector('button[type="submit"]');
          if (playBtn) {
            playBtn.addEventListener('click', function(e) {
              
              const elem = document.documentElement;
              if (elem.requestFullscreen) {
                elem.requestFullscreen();
              } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
              } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
              }
            });
          }
        }
      });