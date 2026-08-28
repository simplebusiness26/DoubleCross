(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const menu = document.getElementById('menu');
  const gameScreen = document.getElementById('game');
  const result = document.getElementById('result');
  const statusText = document.getElementById('statusText');
  const teamIntelEl = document.getElementById('teamIntel');
  const rivalIntelEl = document.getElementById('rivalIntel');
  const resultKicker = document.getElementById('resultKicker');
  const resultTitle = document.getElementById('resultTitle');
  const resultText = document.getElementById('resultText');

  const MAP = [
    '#################',
    '#..C....#....C..#',
    '#.......#.......#',
    '#..##...#...##..#',
    '#C......C......C#',
    '###.###...###.###',
    '#.......E.......#',
    '###.###...###.###',
    '#C......C......C#',
    '#..##...#...##..#',
    '#.......#.......#',
    '#..C....#....C..#',
    '#################'
  ];

  const ROWS = MAP.length;
  const COLS = MAP[0].length;
  const TEAM_GOAL = 3;

  const difficultyProfiles = {
    easy: {
      enemySpeed: 2.05,
      enemyThink: 1.05,
      enemyTrapChance: 0.025,
      enemyTargetNoise: 8,
      allySpeed: 2.65,
      allyThink: 0.45,
      allyTrapChance: 0.08
    },
    medium: {
      enemySpeed: 2.45,
      enemyThink: 0.58,
      enemyTrapChance: 0.07,
      enemyTargetNoise: 3.5,
      allySpeed: 2.55,
      allyThink: 0.55,
      allyTrapChance: 0.06
    },
    hard: {
      enemySpeed: 2.82,
      enemyThink: 0.28,
      enemyTrapChance: 0.15,
      enemyTargetNoise: 1.0,
      allySpeed: 2.58,
      allyThink: 0.48,
      allyTrapChance: 0.05
    }
  };

  let selectedDifficulty = 'medium';
  let running = false;
  let lastTime = 0;
  let game = null;
  let layout = { tile: 32, ox: 0, oy: 0 };

  const keys = new Set();
  const joystickVector = { x: 0, y: 0 };

  function showScreen(screen) {
    [menu, gameScreen, result].forEach(el => el.classList.remove('active'));
    screen.classList.add('active');
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function mapTile(tx, ty) {
    if (ty < 0 || ty >= ROWS || tx < 0 || tx >= COLS) return '#';
    return MAP[ty][tx];
  }

  function isWalkable(tx, ty) {
    return mapTile(tx, ty) !== '#';
  }

  function centerOf(tx, ty) {
    return { x: tx + 0.5, y: ty + 0.5 };
  }

  function tileOf(entity) {
    return { x: Math.floor(entity.x), y: Math.floor(entity.y) };
  }

  function makeAgent(id, name, team, role, tx, ty) {
    const p = centerOf(tx, ty);
    return {
      id,
      name,
      team,
      role,
      x: p.x,
      y: p.y,
      radius: 0.27,
      speed: role === 'player' ? 3.0 : 2.5,
      stun: 0,
      trapCharges: role === 'player' ? 3 : 2,
      trapCooldown: 0,
      thinkTimer: 0,
      target: null,
      path: [],
      facingX: 0,
      facingY: 1
    };
  }

  function createGame() {
    const containers = [];
    let extraction = null;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAP[y][x] === 'C') {
          const p = centerOf(x, y);
          containers.push({ id: `c-${x}-${y}`, tx: x, ty: y, x: p.x, y: p.y, searched: false, intel: false });
        }
        if (MAP[y][x] === 'E') {
          const p = centerOf(x, y);
          extraction = { tx: x, ty: y, x: p.x, y: p.y };
        }
      }
    }

    shuffle(containers.slice()).slice(0, Math.min(6, containers.length)).forEach(c => { c.intel = true; });

    const player = makeAgent('player', 'YOU', 'blue', 'player', 1, 1);
    const ally = makeAgent('ally', 'ECHO', 'blue', 'ally', 2, 2);
    const rivalA = makeAgent('rival-a', 'VIPER', 'red', 'enemy', 15, 11);
    const rivalB = makeAgent('rival-b', 'ROOK', 'red', 'enemy', 14, 10);

    const profile = difficultyProfiles[selectedDifficulty];
    ally.speed = profile.allySpeed;
    rivalA.speed = profile.enemySpeed;
    rivalB.speed = profile.enemySpeed * 0.98;

    return {
      player,
      agents: [player, ally, rivalA, rivalB],
      containers,
      extraction,
      traps: [],
      intel: { blue: 0, red: 0 },
      profile,
      ended: false,
      elapsed: 0,
      statusTimer: 0,
      announcedBlueReady: false,
      announcedRedReady: false
    };
  }

  function setStatus(text, seconds = 2.2) {
    if (!game) return;
    statusText.textContent = text;
    game.statusTimer = seconds;
  }

  function updateHud() {
    teamIntelEl.textContent = `${game.intel.blue} / ${TEAM_GOAL}`;
    rivalIntelEl.textContent = `${game.intel.red} / ${TEAM_GOAL}`;
  }

  function startGame() {
    game = createGame();
    updateHud();
    statusText.textContent = 'Search the mansion. Find 3 intel files.';
    running = true;
    lastTime = performance.now();
    showScreen(gameScreen);
    resizeCanvas();

    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }

    requestAnimationFrame(loop);
  }

  function endGame(winner) {
    if (!game || game.ended) return;
    game.ended = true;
    running = false;

    if (winner === 'blue') {
      resultKicker.textContent = 'OPERATION COMPLETE';
      resultTitle.textContent = 'EXTRACTED';
      resultText.textContent = `You and Echo recovered the intelligence and escaped in ${Math.ceil(game.elapsed)} seconds.`;
    } else {
      resultKicker.textContent = 'MISSION COMPROMISED';
      resultTitle.textContent = 'DOUBLE-CROSSED';
      resultText.textContent = 'The rival team reached extraction first. Change your route, use your traps, and go again.';
    }
    showScreen(result);
  }

  function collisionFree(x, y, radius) {
    const points = [
      [x - radius, y - radius],
      [x + radius, y - radius],
      [x - radius, y + radius],
      [x + radius, y + radius]
    ];
    return points.every(([px, py]) => isWalkable(Math.floor(px), Math.floor(py)));
  }

  function moveAgent(agent, dx, dy, dt) {
    if (agent.stun > 0) return;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return;
    dx /= length;
    dy /= length;
    agent.facingX = dx;
    agent.facingY = dy;

    const step = agent.speed * dt;
    const nx = agent.x + dx * step;
    const ny = agent.y + dy * step;

    if (collisionFree(nx, agent.y, agent.radius)) agent.x = nx;
    if (collisionFree(agent.x, ny, agent.radius)) agent.y = ny;
  }

  function updatePlayer(dt) {
    let dx = joystickVector.x;
    let dy = joystickVector.y;

    if (keys.has('arrowleft') || keys.has('a')) dx -= 1;
    if (keys.has('arrowright') || keys.has('d')) dx += 1;
    if (keys.has('arrowup') || keys.has('w')) dy -= 1;
    if (keys.has('arrowdown') || keys.has('s')) dy += 1;

    moveAgent(game.player, dx, dy, dt);
  }

  function findPath(start, goal) {
    const startKey = `${start.x},${start.y}`;
    const goalKey = `${goal.x},${goal.y}`;
    if (startKey === goalKey) return [];

    const queue = [start];
    const visited = new Set([startKey]);
    const parent = new Map();
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

    while (queue.length) {
      const current = queue.shift();
      for (const [dx, dy] of dirs) {
        const next = { x: current.x + dx, y: current.y + dy };
        const key = `${next.x},${next.y}`;
        if (!isWalkable(next.x, next.y) || visited.has(key)) continue;
        visited.add(key);
        parent.set(key, current);
        if (key === goalKey) {
          const path = [next];
          let walk = current;
          while (`${walk.x},${walk.y}` !== startKey) {
            path.push(walk);
            walk = parent.get(`${walk.x},${walk.y}`);
          }
          path.reverse();
          return path;
        }
        queue.push(next);
      }
    }
    return [];
  }

  function chooseContainerTarget(agent) {
    const available = game.containers.filter(c => !c.searched);
    if (!available.length) return null;

    const noise = agent.team === 'red' ? game.profile.enemyTargetNoise : 2.2;
    const scored = available.map(c => ({
      c,
      score: Math.abs(agent.x - c.x) + Math.abs(agent.y - c.y) + Math.random() * noise
    }));
    scored.sort((a, b) => a.score - b.score);

    if (agent.team === 'red' && selectedDifficulty === 'hard') {
      const player = game.player;
      for (const item of scored) {
        const playerDistance = Math.abs(player.x - item.c.x) + Math.abs(player.y - item.c.y);
        item.score -= Math.max(0, 5 - playerDistance) * 0.45;
      }
      scored.sort((a, b) => a.score - b.score);
    }

    return scored[0].c;
  }

  function setBotTarget(agent) {
    const teamIntel = game.intel[agent.team];
    let target;

    if (teamIntel >= TEAM_GOAL) {
      target = { ...game.extraction, id: 'exit', type: 'exit' };
    } else {
      const container = chooseContainerTarget(agent);
      target = container ? { ...container, type: 'container' } : { ...game.extraction, id: 'exit', type: 'exit' };
    }

    agent.target = target;
    if (target) {
      agent.path = findPath(tileOf(agent), { x: target.tx, y: target.ty });
    }
  }

  function searchContainer(agent, container) {
    if (!container || container.searched) return false;
    container.searched = true;

    if (container.intel) {
      game.intel[agent.team] += 1;
      if (agent.team === 'blue') {
        setStatus(agent.role === 'player' ? 'Intel secured.' : 'Echo found an intel file.');
      } else {
        setStatus('A rival secured intelligence.');
      }
      updateHud();
    } else {
      agent.trapCharges = Math.min(4, agent.trapCharges + 1);
      if (agent.role === 'player') setStatus('No intel. You recovered a trap charge.');
    }

    agent.target = null;
    agent.path = [];
    return true;
  }

  function placeTrap(agent) {
    if (!game || game.ended || agent.stun > 0 || agent.trapCharges <= 0 || agent.trapCooldown > 0) return false;
    const tile = tileOf(agent);
    if (!isWalkable(tile.x, tile.y) || mapTile(tile.x, tile.y) === 'E') return false;
    if (game.traps.some(t => t.tx === tile.x && t.ty === tile.y)) return false;

    game.traps.push({
      id: `trap-${Date.now()}-${Math.random()}`,
      tx: tile.x,
      ty: tile.y,
      x: tile.x + 0.5,
      y: tile.y + 0.5,
      team: agent.team,
      owner: agent.id
    });
    agent.trapCharges -= 1;
    agent.trapCooldown = 1.0;
    if (agent.role === 'player') setStatus(`Trap armed. ${agent.trapCharges} remaining.`);
    return true;
  }

  function checkTraps(agent) {
    if (agent.stun > 0) return;
    const tile = tileOf(agent);
    const index = game.traps.findIndex(t => t.team !== agent.team && t.tx === tile.x && t.ty === tile.y);
    if (index === -1) return;

    game.traps.splice(index, 1);
    agent.stun = 1.55;
    agent.path = [];
    agent.target = null;

    if (agent.role === 'player') setStatus('TRAP! You are stunned.', 1.6);
    else if (agent.team === 'blue') setStatus('Echo triggered a rival trap.', 1.6);
    else setStatus(`${agent.name} triggered your team’s trap.`, 1.6);
  }

  function maybeBotTrap(agent, dt) {
    if (agent.trapCharges <= 0 || agent.trapCooldown > 0) return;
    const chance = agent.team === 'red' ? game.profile.enemyTrapChance : game.profile.allyTrapChance;
    if (Math.random() > chance * dt) return;

    const opponents = game.agents.filter(a => a.team !== agent.team);
    const nearbyOpponent = opponents.some(a => dist(a, agent) < (selectedDifficulty === 'hard' ? 4.5 : 3.0));
    const recentlyUsefulSpot = game.containers.some(c => c.searched && dist(c, agent) < 1.2);
    if (nearbyOpponent || recentlyUsefulSpot) placeTrap(agent);
  }

  function updateBot(agent, dt) {
    if (agent.stun > 0) return;

    const thinkInterval = agent.team === 'red' ? game.profile.enemyThink : game.profile.allyThink;
    agent.thinkTimer -= dt;

    if (!agent.target || agent.thinkTimer <= 0 || (agent.target.type === 'container' && game.containers.find(c => c.id === agent.target.id)?.searched)) {
      setBotTarget(agent);
      agent.thinkTimer = thinkInterval;
    }

    if (!agent.target) return;

    if (agent.target.type === 'container' && dist(agent, agent.target) < 0.62) {
      const liveContainer = game.containers.find(c => c.id === agent.target.id);
      searchContainer(agent, liveContainer);
      maybeBotTrap(agent, 2.5);
      return;
    }

    if (agent.target.type === 'exit' && dist(agent, game.extraction) < 0.58 && game.intel[agent.team] >= TEAM_GOAL) {
      endGame(agent.team);
      return;
    }

    if (!agent.path.length) {
      agent.path = findPath(tileOf(agent), { x: agent.target.tx, y: agent.target.ty });
    }

    if (agent.path.length) {
      const next = centerOf(agent.path[0].x, agent.path[0].y);
      const dx = next.x - agent.x;
      const dy = next.y - agent.y;
      if (Math.hypot(dx, dy) < 0.16) agent.path.shift();
      else moveAgent(agent, dx, dy, dt);
    }

    maybeBotTrap(agent, dt);
  }

  function tryPlayerInteract() {
    if (!game || game.ended || game.player.stun > 0) return;

    const candidates = game.containers
      .filter(c => !c.searched)
      .map(c => ({ c, d: dist(game.player, c) }))
      .filter(item => item.d < 0.9)
      .sort((a, b) => a.d - b.d);

    if (candidates.length) {
      searchContainer(game.player, candidates[0].c);
      return;
    }

    if (dist(game.player, game.extraction) < 0.8) {
      if (game.intel.blue >= TEAM_GOAL) endGame('blue');
      else setStatus(`Extraction locked. Need ${TEAM_GOAL - game.intel.blue} more intel.`);
      return;
    }

    setStatus('Nothing to interact with here.', 1.2);
  }

  function update(dt) {
    if (!game || game.ended) return;
    game.elapsed += dt;

    for (const agent of game.agents) {
      agent.stun = Math.max(0, agent.stun - dt);
      agent.trapCooldown = Math.max(0, agent.trapCooldown - dt);
    }

    updatePlayer(dt);
    for (const agent of game.agents) {
      if (agent.role !== 'player') updateBot(agent, dt);
    }

    for (const agent of game.agents) checkTraps(agent);

    if (game.intel.blue >= TEAM_GOAL && !game.announcedBlueReady) {
      game.announcedBlueReady = true;
      setStatus('TEAM OBJECTIVE COMPLETE — GET TO EXTRACTION!', 3);
    }
    if (game.intel.red >= TEAM_GOAL && !game.announcedRedReady) {
      game.announcedRedReady = true;
      setStatus('RIVALS HAVE THE INTEL — STOP THEIR EXTRACTION!', 3);
    }

    if (game.statusTimer > 0) {
      game.statusTimer -= dt;
      if (game.statusTimer <= 0) {
        if (game.intel.blue >= TEAM_GOAL) statusText.textContent = 'Reach extraction!';
        else statusText.textContent = 'Search. Trap. Outsmart.';
      }
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tile = Math.min(rect.width / COLS, rect.height / ROWS);
    layout = {
      tile,
      ox: (rect.width - COLS * tile) / 2,
      oy: (rect.height - ROWS * tile) / 2
    };
  }

  function toScreen(x, y) {
    return {
      x: layout.ox + x * layout.tile,
      y: layout.oy + y * layout.tile
    };
  }

  function drawMap() {
    const { tile, ox, oy } = layout;

    ctx.fillStyle = '#0b0f15';
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const sx = ox + x * tile;
        const sy = oy + y * tile;
        const t = MAP[y][x];

        if (t === '#') {
          ctx.fillStyle = '#232b38';
          ctx.fillRect(sx, sy, tile + 0.5, tile + 0.5);
          ctx.fillStyle = 'rgba(255,255,255,.035)';
          ctx.fillRect(sx + tile * .08, sy + tile * .08, tile * .84, tile * .13);
        } else {
          ctx.fillStyle = (x + y) % 2 ? '#141b24' : '#121923';
          ctx.fillRect(sx, sy, tile + 0.5, tile + 0.5);
          ctx.strokeStyle = 'rgba(255,255,255,.025)';
          ctx.strokeRect(sx, sy, tile, tile);
        }
      }
    }

    const e = toScreen(game.extraction.x, game.extraction.y);
    const ready = game.intel.blue >= TEAM_GOAL;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = ready ? 'rgba(255,207,74,.22)' : 'rgba(255,255,255,.07)';
    ctx.strokeStyle = ready ? '#ffcf4a' : '#66717e';
    ctx.lineWidth = Math.max(2, tile * .05);
    ctx.beginPath();
    ctx.arc(0, 0, tile * .34, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ready ? '#ffcf4a' : '#8d98a6';
    ctx.font = `900 ${Math.max(8, tile * .18)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', 0, 0);
    ctx.restore();
  }

  function drawContainers() {
    const tile = layout.tile;
    for (const c of game.containers) {
      const p = toScreen(c.x, c.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = c.searched ? '#343a43' : '#845f36';
      ctx.strokeStyle = c.searched ? '#4f5661' : '#bf8b4e';
      ctx.lineWidth = Math.max(1, tile * .035);
      ctx.fillRect(-tile * .29, -tile * .21, tile * .58, tile * .42);
      ctx.strokeRect(-tile * .29, -tile * .21, tile * .58, tile * .42);
      ctx.fillStyle = c.searched ? '#5f6670' : '#e7bd72';
      ctx.fillRect(-tile * .035, -tile * .025, tile * .07, tile * .07);
      ctx.restore();
    }
  }

  function drawTraps() {
    const tile = layout.tile;
    for (const trap of game.traps) {
      if (trap.team === 'red') continue;
      const p = toScreen(trap.x, trap.y);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = '#52e0c4';
      ctx.lineWidth = Math.max(1.5, tile * .04);
      ctx.beginPath();
      ctx.arc(0, 0, tile * .18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-tile*.12, -tile*.12);
      ctx.lineTo(tile*.12, tile*.12);
      ctx.moveTo(tile*.12, -tile*.12);
      ctx.lineTo(-tile*.12, tile*.12);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawAgent(agent) {
    const p = toScreen(agent.x, agent.y);
    const tile = layout.tile;
    const palette = agent.role === 'player'
      ? { body: '#ffcf4a', edge: '#fff0ae', text: '#17130a' }
      : agent.team === 'blue'
        ? { body: '#52e0c4', edge: '#adfff0', text: '#0c2924' }
        : { body: '#ff6a75', edge: '#ffc0c5', text: '#3a0c10' };

    ctx.save();
    ctx.translate(p.x, p.y);

    if (agent.stun > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = .7;
      ctx.lineWidth = Math.max(1.5, tile * .035);
      ctx.beginPath();
      ctx.arc(0, -tile * .08, tile * .38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(0, tile * .24, tile * .25, tile * .11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.body;
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = Math.max(1, tile * .035);
    ctx.beginPath();
    ctx.moveTo(0, -tile * .28);
    ctx.lineTo(tile * .25, tile * .24);
    ctx.lineTo(-tile * .25, tile * .24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#131821';
    ctx.beginPath();
    ctx.arc(0, -tile * .22, tile * .15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.edge;
    ctx.stroke();

    ctx.fillStyle = palette.body;
    ctx.fillRect(-tile * .16, -tile * .31, tile * .32, tile * .06);

    ctx.fillStyle = palette.edge;
    ctx.font = `900 ${Math.max(7, tile * .13)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(agent.name, 0, -tile * .43);

    ctx.restore();
  }

  function drawInteractionHint() {
    const player = game.player;
    const nearContainer = game.containers.some(c => !c.searched && dist(player, c) < 0.9);
    const nearExit = dist(player, game.extraction) < 0.8;
    if (!nearContainer && !nearExit) return;

    const p = toScreen(player.x, player.y - .62);
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,20,.9)';
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    const w = layout.tile * 1.25;
    const h = layout.tile * .38;
    ctx.beginPath();
    ctx.roundRect(p.x - w/2, p.y - h/2, w, h, h/2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4f1e8';
    ctx.font = `800 ${Math.max(8, layout.tile * .14)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(nearContainer ? 'SEARCH' : 'EXTRACT', p.x, p.y);
    ctx.restore();
  }

  function draw() {
    if (!game) return;
    drawMap();
    drawContainers();
    drawTraps();
    for (const agent of game.agents) drawAgent(agent);
    drawInteractionHint();
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);
    draw();
    if (running) requestAnimationFrame(loop);
  }

  document.querySelectorAll('.difficulty').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.difficulty').forEach(b => b.classList.remove('selected'));
      button.classList.add('selected');
      selectedDifficulty = button.dataset.difficulty;
    });
  });

  document.getElementById('startButton').addEventListener('click', startGame);
  document.getElementById('rematchButton').addEventListener('click', startGame);
  document.getElementById('menuButton').addEventListener('click', () => { running = false; showScreen(menu); });
  document.getElementById('resultMenuButton').addEventListener('click', () => showScreen(menu));
  document.getElementById('interactButton').addEventListener('pointerdown', e => { e.preventDefault(); tryPlayerInteract(); });
  document.getElementById('trapButton').addEventListener('pointerdown', e => { e.preventDefault(); placeTrap(game?.player); });

  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    keys.add(key);
    if (['arrowup','arrowdown','arrowleft','arrowright',' ','e'].includes(key)) e.preventDefault();
    if (key === ' ') tryPlayerInteract();
    if (key === 'e') placeTrap(game?.player);
  }, { passive: false });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('resize', resizeCanvas);

  const joystick = document.getElementById('joystick');
  const stick = document.getElementById('stick');
  let joystickPointer = null;

  function updateJoystick(e) {
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width * .31;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const length = Math.hypot(dx, dy);
    if (length > max) {
      dx = dx / length * max;
      dy = dy / length * max;
    }
    joystickVector.x = dx / max;
    joystickVector.y = dy / max;
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function resetJoystick() {
    joystickPointer = null;
    joystickVector.x = 0;
    joystickVector.y = 0;
    stick.style.transform = 'translate(0, 0)';
  }

  joystick.addEventListener('pointerdown', e => {
    joystickPointer = e.pointerId;
    joystick.setPointerCapture(e.pointerId);
    updateJoystick(e);
  });
  joystick.addEventListener('pointermove', e => {
    if (e.pointerId === joystickPointer) updateJoystick(e);
  });
  joystick.addEventListener('pointerup', e => {
    if (e.pointerId === joystickPointer) resetJoystick();
  });
  joystick.addEventListener('pointercancel', resetJoystick);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
