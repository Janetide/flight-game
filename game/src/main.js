// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between six screens: title, briefing, play, paused, mission complete and
// crashed. ?seed=N fixes the world. ?shot=takeoff|rings|landing|cockpit
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.

import { GAME_NAME, MISSIONS, PLANE_NAME, WORLD_SEED } from './config.js';
import { buildScenery } from './terrain.js';
import { createMission, missionById, objectiveLine, progressLine, stepMission } from './missions.js';
import { stepPlane } from './physics.js';
import { renderScene } from './render.js';
import { drawCockpitFrame } from './aircraft.js';
import { drawHud } from './hud.js';
import { createAudio } from './audio.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_GEAR, ACTION_MENU, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : WORLD_SEED;

// Surface any load or runtime error in the title, so a headless play-test
// can see it without a debugger attached.
window.addEventListener('error', (e) => {
  document.title = 'ERROR: ' + e.message;
  window.__gameError = String(e.message);
});

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = createAudio();
const scenery = buildScenery(seed);

let screen = 'title';
let missionIndex = 0;
let mission = null;
let cameraMode = 'chase';
let time = 0;
let last = performance.now();
let messageAlpha = 1;
let bestScores = readBest();

function readBest() {
  try {
    return JSON.parse(window.localStorage.getItem('skyline-courier-best') ?? '{}');
  } catch {
    return {};
  }
}

function saveBest() {
  try {
    window.localStorage.setItem('skyline-courier-best', JSON.stringify(bestScores));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  const w = Math.floor(canvas.clientWidth * ratio);
  const h = Math.floor(canvas.clientHeight * ratio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function startMission(index) {
  missionIndex = index;
  mission = createMission(MISSIONS[index], seed);
  cameraMode = 'chase';
  screen = 'briefing';
  audio.unlock();
  audio.click();
}

function restartMission() {
  mission = createMission(MISSIONS[missionIndex], seed);
  screen = 'play';
  audio.click();
}

function currentView() {
  const m = mission;
  const p = m.plane;
  const now = m.timeFlown;
  const showMessage = m.message && now < m.messageUntil;
  messageAlpha = showMessage ? Math.min(1, (m.messageUntil - now) / 0.6) : 0;
  return {
    plane: p,
    mission: m.def,
    objective: objectiveLine(m),
    progress: progressLine(m),
    timeLeft: m.def.timeLimit > 0 ? m.timeLeft : null,
    score: m.score,
    message: showMessage ? m.message : '',
    subMessage: showMessage ? m.subMessage : '',
    messageColor: m.messageColor,
    messageAlpha,
  };
}

function frame(now) {
  const dt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  time += dt;
  resize();
  const actions = input.readActions();
  if (actions.has(ACTION_MUTE)) {
    const muted = audio.toggleMute();
    if (screen === 'title') status.textContent = muted ? 'Sound off' : 'Sound on';
  }
  if (actions.has(ACTION_CAMERA)) {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
  }

  if (screen === 'title') {
    if (actions.has(ACTION_CONFIRM)) {
      const pos = input.clickPosition();
      const choice = pickMission(pos);
      startMission(choice ?? missionIndex);
    }
    if (actions.has(ACTION_RESTART)) startMission(missionIndex);
    drawTitle();
  } else if (screen === 'briefing') {
    if (actions.has(ACTION_CONFIRM) || actions.has(ACTION_RESTART)) {
      screen = 'play';
      audio.click();
    }
    drawBriefing();
  } else if (screen === 'play') {
    if (actions.has(ACTION_PAUSE)) {
      screen = 'paused';
    } else if (actions.has(ACTION_RESTART)) {
      restartMission();
    } else if (actions.has(ACTION_MENU)) {
      screen = 'title';
    } else {
      const ctl = input.readControls();
      if (actions.has(ACTION_GEAR)) {
        mission.plane.gearDown = !mission.plane.gearDown;
        audio.click();
      }
      mission.plane.braking = ctl.brake;
      let acc = 0;
      const steps = Math.max(1, Math.round(dt / STEP));
      for (let i = 0; i < steps; i++) {
        const events = stepPlane(mission.plane, ctl, STEP);
        stepMission(mission, STEP, mission.timeFlown, events);
        acc += STEP;
        for (const e of events) {
          if (e === 'takeoff') audio.takeoff();
          if (e === 'touchdown') audio.touchdown();
          if (e === 'crash') audio.crash();
          if (e === 'stall' || e === 'fuel-empty') audio.warning();
        }
        if (mission.ringsPassed > (mission.lastRingSound ?? 0)) {
          mission.lastRingSound = mission.ringsPassed;
          audio.ring();
        }
        if (mission.complete && !mission.completeSound) {
          mission.completeSound = true;
          audio.complete();
        }
      }
      audio.update(mission.plane);
      if (mission.complete || mission.failed) {
        if (mission.complete) {
          const key = mission.def.id;
          if (mission.score > (bestScores[key] ?? 0)) {
            bestScores[key] = mission.score;
            saveBest();
          }
        }
        screen = mission.complete ? 'done' : 'crashed';
      }
      drawPlay();
    }
    if (screen === 'paused') drawPaused();
  } else if (screen === 'paused') {
    if (actions.has(ACTION_PAUSE) || actions.has(ACTION_CONFIRM)) screen = 'play';
    else if (actions.has(ACTION_RESTART)) restartMission();
    else if (actions.has(ACTION_MENU)) screen = 'title';
    drawPaused();
  } else if (screen === 'done' || screen === 'crashed') {
    drawEnd();
    if (actions.has(ACTION_RESTART)) restartMission();
    else if (actions.has(ACTION_MENU)) screen = 'title';
  }

  if (!shotName) requestAnimationFrame(frame);
}

function pickMission(pos) {
  // Title screen mission rows, in normalised coordinates.
  const rows = [
    { y0: 0.52, y1: 0.62, index: 0 },
    { y0: 0.63, y1: 0.73, index: 1 },
    { y0: 0.74, y1: 0.84, index: 2 },
  ];
  for (const row of rows) {
    if (pos.y >= row.y0 && pos.y < row.y1 && pos.x > 0.2 && pos.x < 0.8) return row.index;
  }
  return null;
}

function drawPlay() {
  const w = canvas.width;
  const h = canvas.height;
  renderScene(ctx, w, h, mission.plane, { scenery, rings: mission.rings, nextRing: mission.nextRing }, time, cameraMode);
  if (cameraMode === 'cockpit') drawCockpitFrame(ctx, w, h, mission.plane, time);
  drawHud(ctx, w, h, currentView());
}

function panel(ctx, w, h, title, lines, footer) {
  const s = Math.min(w, h) / 760;
  ctx.fillStyle = 'rgba(8,16,26,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc857';
  ctx.font = `bold ${44 * s}px system-ui, sans-serif`;
  ctx.fillText(title, w / 2, h * 0.2);
  ctx.fillStyle = '#e8f2ff';
  ctx.font = `${18 * s}px system-ui, sans-serif`;
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, h * 0.2 + (46 + i * 30) * s);
  });
  if (footer) {
    ctx.fillStyle = '#7dffb0';
    ctx.font = `bold ${20 * s}px system-ui, sans-serif`;
    ctx.fillText(footer, w / 2, h * 0.86);
  }
}

function drawTitle() {
  const w = canvas.width;
  const h = canvas.height;
  // A painted backdrop: sky and valley behind the menu, so the title already
  // looks like the game.
  const fake = { x: 0, y: 320, z: -600, heading: 350, pitch: -4, roll: 0, speed: 60, throttle: 0.7, onGround: false, gearDown: true, fuel: 100, damage: 0, verticalSpeed: 0 };
  renderScene(ctx, w, h, fake, { scenery, rings: [], nextRing: 0 }, time, 'chase');
  const s = Math.min(w, h) / 760;
  ctx.fillStyle = 'rgba(8,16,26,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc857';
  ctx.font = `bold ${64 * s}px system-ui, sans-serif`;
  ctx.fillText(GAME_NAME, w / 2, h * 0.2);
  ctx.fillStyle = '#e8f2ff';
  ctx.font = `${20 * s}px system-ui, sans-serif`;
  ctx.fillText('Fly the ' + PLANE_NAME + ' over the valley. Three sorties, one runway, no fuel to waste.', w / 2, h * 0.2 + 40 * s);
  MISSIONS.forEach((m, i) => {
    const y = h * (0.52 + i * 0.11);
    const best = bestScores[m.id] ? '   •   Best ' + bestScores[m.id] : '';
    ctx.fillStyle = i === missionIndex ? 'rgba(255,176,46,0.25)' : 'rgba(8,16,26,0.55)';
    ctx.fillRect(w * 0.2, y - 30 * s, w * 0.6, 62 * s);
    ctx.strokeStyle = i === missionIndex ? '#ffc857' : 'rgba(232,242,255,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.2, y - 30 * s, w * 0.6, 62 * s);
    ctx.fillStyle = '#e8f2ff';
    ctx.font = `bold ${20 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText((i + 1) + '. ' + m.name + best, w * 0.2 + 16 * s, y + 2 * s);
    ctx.fillStyle = '#9fb6cc';
    ctx.font = `${14 * s}px system-ui, sans-serif`;
    ctx.fillText(m.goal, w * 0.2 + 16 * s, y + 24 * s);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fb6cc';
  ctx.font = `${15 * s}px system-ui, sans-serif`;
  ctx.fillText('Click a mission or press 1–3, then Enter.  W/S pitch  •  A/D bank  •  Shift/Ctrl throttle  •  Q/E rudder  •  G gear  •  B brake  •  C camera  •  P pause  •  X sound', w / 2, h * 0.9);
  ctx.fillStyle = '#7dffb0';
  ctx.font = `bold ${17 * s}px system-ui, sans-serif`;
  ctx.fillText('Press Enter to fly', w / 2, h * 0.95);
  status.textContent = GAME_NAME + '. Choose a mission and press Enter.';
}

function drawBriefing() {
  const w = canvas.width;
  const h = canvas.height;
  const m = MISSIONS[missionIndex];
  panel(
    ctx,
    w,
    h,
    m.name,
    [m.goal, '', 'Tip: ' + m.tip, '', 'Throttle: Shift up / Ctrl down / mouse wheel', 'Steer: W/S pitch, A/D bank, hold mouse to steer', 'Gear: G   •   Brake: B   •   Camera: C   •   Pause: P'],
    'Press Enter to take the runway',
  );
  status.textContent = m.name + '. ' + m.goal;
}

function drawPaused() {
  const w = canvas.width;
  const h = canvas.height;
  drawPlay();
  panel(ctx, w, h, 'PAUSED', ['The valley waits.'], 'Enter to keep flying  •  R to restart  •  M for the menu');
}

function drawEnd() {
  const w = canvas.width;
  const h = canvas.height;
  drawPlay();
  const m = mission;
  if (m.complete) {
    panel(ctx, w, h, 'MISSION COMPLETE', [
      m.def.name + ' — Score ' + m.score,
      'Best for this mission: ' + (bestScores[m.def.id] ?? m.score),
      'Fuel left ' + Math.round(m.plane.fuel) + '%   •   Damage ' + Math.round(m.plane.damage) + '%   •   Time ' + Math.round(m.timeFlown) + ' s',
    ], 'R to fly again  •  M for the menu');
    status.textContent = 'Mission complete. Score ' + m.score + '.';
  } else {
    panel(ctx, w, h, 'FLIGHT OVER', [
      m.failReason || 'The sortie ended.',
      'Score ' + m.score + '   •   Rings ' + m.ringsPassed + '/' + m.rings.length,
    ], 'R to try again  •  M for the menu');
    status.textContent = 'Flight over. ' + (m.failReason || '');
  }
}

// --- screenshot staging ---
if (shotName) {
  resize();
  const staged = stageShot(shotName, seed);
  if (staged) {
    const m = staged.mission;
    mission = m;
    missionIndex = MISSIONS.findIndex((x) => x.id === m.def.id);
    cameraMode = staged.cameraMode;
    const w = canvas.width;
    const h = canvas.height;
    for (let i = 0; i < 2; i++) {
      renderScene(ctx, w, h, m.plane, { scenery, rings: m.rings, nextRing: m.nextRing }, time, cameraMode);
      if (cameraMode === 'cockpit') drawCockpitFrame(ctx, w, h, m.plane, time);
      drawHud(ctx, w, h, currentView());
    }
    window.__shotReady = true;
  } else {
    window.__shotReady = false;
  }
} else {
  // Number keys pick a mission on the title screen.
  window.addEventListener('keydown', (e) => {
    if (screen === 'title' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
      missionIndex = Number(e.code.slice(-1)) - 1;
    }
  });
  resize();
  requestAnimationFrame(frame);
}
