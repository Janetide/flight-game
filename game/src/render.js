// The world renderer: sky, sun and far ridge, then a projected carpet of
// terrain quads ahead of the camera, the runway strip, the rings, the trees,
// the houses and the clouds. Everything is drawn from the plane's position,
// so the view is always the view from the cockpit of the moment.

import { RUNWAY, RUNWAY_COLOR, RING_COLOR, RING_NEXT, SKY_HORIZON, SKY_TOP, SUN_COLOR } from './config.js';
import { groundColor, groundHeight } from './terrain.js';
import { cameraFor, drawPlaneChase, planeScreenPos } from './aircraft.js';
import { fbm } from './random.js';

const ROWS = 20;
const COLS = 21;
const NEAR = 60;
const FAR = 3200;

function project(cam, p, w, h, focal) {
  const vx = p.x - cam.pos.x;
  const vy = p.y - cam.pos.y;
  const vz = p.z - cam.pos.z;
  const cx = vx * cam.right.x + vy * cam.right.y + vz * cam.right.z;
  const cy = vx * cam.up.x + vy * cam.up.y + vz * cam.up.z;
  const cz = vx * cam.forward.x + vy * cam.forward.y + vz * cam.forward.z;
  if (cz < 6) return null;
  return {
    x: w / 2 + (cx * focal) / cz,
    y: h / 2 - (cy * focal) / cz,
    d: cz,
  };
}

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

function fog(color, d) {
  const t = Math.min(0.88, (d / FAR) * 0.9);
  return mix(color, SKY_HORIZON, t);
}

/** Scale a colour's brightness by (1 + f); f in [-0.2, 0.2] keeps it natural. Returns hex. */
function shade(hex, f) {
  const m = [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const parts = m.map((v) => Math.max(0, Math.min(255, Math.round(v * (1 + f)))).toString(16).padStart(2, '0'));
  return '#' + parts.join('');
}

function rowDistance(i) {
  return NEAR * Math.pow(FAR / NEAR, i / (ROWS - 1));
}

/** Paint the whole scene for one frame. */
export function renderScene(ctx, w, h, plane, world, time, cameraMode) {
  const focal = h * 1.05;
  const cam = cameraFor(plane, cameraMode);
  drawSky(ctx, w, h, cam, time);
  drawTerrainCarpet(ctx, w, h, cam, focal);
  drawRunway(ctx, w, h, cam, focal);
  drawTreesAndHouses(ctx, w, h, cam, focal, world.scenery);
  drawClouds(ctx, w, h, cam, focal, world.scenery.clouds, time);
  drawRings(ctx, w, h, cam, focal, world.rings, world.nextRing);
  if (cameraMode === 'chase') {
    const pos = planeScreenPos(w, h);
    const scale = Math.min(w, h) / 760;
    drawPlaneChase(ctx, pos.x, pos.y, plane.roll, scale, time, plane.throttle);
  }
}

function drawSky(ctx, w, h, cam, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(0.55, '#8fb8e2');
  grad.addColorStop(0.75, SKY_HORIZON);
  grad.addColorStop(1, '#cfe0d8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Sun: fixed in the west-northwest sky.
  const sunDir = { x: -0.55, y: 0.42, z: -0.72 };
  const sd = {
    x: sunDir.x * cam.right.x + sunDir.y * cam.right.y + sunDir.z * cam.right.z,
    y: sunDir.x * cam.up.x + sunDir.y * cam.up.y + sunDir.z * cam.up.z,
    z: sunDir.x * cam.forward.x + sunDir.y * cam.forward.y + sunDir.z * cam.forward.z,
  };
  if (sd.z > 0.05) {
    const sx = w / 2 + (sd.x * h * 1.05) / sd.z;
    const sy = h / 2 - (sd.y * h * 1.05) / sd.z;
    const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 110);
    glow.addColorStop(0, SUN_COLOR);
    glow.addColorStop(0.25, 'rgba(255,240,190,0.55)');
    glow.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 120, sy - 120, 240, 240);
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath();
    ctx.arc(sx, sy, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  // Far ridge: a hazy mountain silhouette along the horizon.
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  for (let x = 0; x <= w; x += 14) {
    const n = fbm(x * 0.004 + 11, 3.7, 99, 3);
    ctx.lineTo(x, h * 0.62 - (n * 0.5 + 0.5) * h * 0.16);
  }
  ctx.lineTo(w, h * 0.62);
  ctx.closePath();
  ctx.fillStyle = 'rgba(122,146,178,0.55)';
  ctx.fill();
}

function drawTerrainCarpet(ctx, w, h, cam, focal) {
  // Sample the ground in a fan ahead of the camera and paint it as quads,
  // far rows first so near ground overlaps them.
  const grid = [];
  for (let i = 0; i < ROWS; i++) {
    const d = rowDistance(i);
    const half = d * 0.85;
    const row = [];
    for (let j = 0; j < COLS; j++) {
      const lat = -half + (2 * half * j) / (COLS - 1);
      const wx = cam.pos.x + cam.forward.x * d + cam.right.x * lat;
      const wz = cam.pos.z + cam.forward.z * d + cam.right.z * lat;
      const gy = groundHeight(wx, wz);
      const p = project(cam, { x: wx, y: gy, z: wz }, w, h, focal);
      const slope = Math.abs(groundHeight(wx + 30, wz) - gy) / 30;
      row.push({ p, h: gy, slope, d, wx, wz });
    }
    grid.push(row);
  }
  for (let i = ROWS - 2; i >= 0; i--) {
    for (let j = 0; j < COLS - 1; j++) {
      const a = grid[i][j];
      const b = grid[i][j + 1];
      const c = grid[i + 1][j + 1];
      const d2 = grid[i + 1][j];
      if (!a.p || !b.p || !c.p || !d2.p) continue;
      const midH = (a.h + b.h + c.h + d2.h) / 4;
      const midSlope = (a.slope + b.slope + c.slope + d2.slope) / 4;
      // Patchwork fields: the meadow is not one flat green, it is many
      // fields of slightly different greens.
      const midX = (a.wx + b.wx + c.wx + d2.wx) / 4;
      const midZ = (a.wz + b.wz + c.wz + d2.wz) / 4;
      const field = fbm(midX * 0.0016 + 3, midZ * 0.0016 + 7, 5, 2) * 0.16;
      ctx.fillStyle = fog(shade(groundColor(midH, midSlope), field), a.d);
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(c.p.x, c.p.y);
      ctx.lineTo(d2.p.x, d2.p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Fill the near ground below the closest row down to the bottom edge.
  const near = grid[0];
  ctx.beginPath();
  let started = false;
  for (let j = 0; j < COLS; j++) {
    if (!near[j].p) continue;
    if (!started) {
      ctx.moveTo(near[j].p.x, near[j].p.y);
      started = true;
    } else {
      ctx.lineTo(near[j].p.x, near[j].p.y);
    }
  }
  if (started) {
    for (let j = COLS - 1; j >= 0; j--) {
      if (!near[j].p) continue;
      ctx.lineTo(near[j].p.x, h);
    }
    ctx.closePath();
    // Same patchwork as the carpet, so the near ground does not read as a
    // flat strip below the quads.
    const fillField = fbm(cam.pos.x * 0.0016 + 3, cam.pos.z * 0.0016 + 7, 5, 2) * 0.16;
    ctx.fillStyle = fog(shade(groundColor(130, 0.1), fillField), NEAR);
    ctx.fill();
  }
}

function drawRunway(ctx, w, h, cam, focal) {
  const steps = 16;
  const half = RUNWAY.width / 2;
  const dir = { x: 0, z: -1 }; // runway points north
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cz = RUNWAY.cz + RUNWAY.length / 2 - t * RUNWAY.length;
    const lp = project(cam, { x: RUNWAY.cx - half, y: RUNWAY.elevation + 0.6, z: cz }, w, h, focal);
    const rp = project(cam, { x: RUNWAY.cx + half, y: RUNWAY.elevation + 0.6, z: cz }, w, h, focal);
    left.push(lp);
    right.push(rp);
  }
  // Asphalt strip.
  for (let i = 0; i < steps; i++) {
    if (!left[i] || !left[i + 1] || !right[i + 1] || !right[i]) continue;
    ctx.fillStyle = fog(RUNWAY_COLOR, left[i].d);
    ctx.beginPath();
    ctx.moveTo(left[i].x, left[i].y);
    ctx.lineTo(right[i].x, right[i].y);
    ctx.lineTo(right[i + 1].x, right[i + 1].y);
    ctx.lineTo(left[i + 1].x, left[i + 1].y);
    ctx.closePath();
    ctx.fill();
  }
  // Centreline dashes and threshold bars.
  ctx.fillStyle = '#f2f2f2';
  for (let i = 0; i < steps; i++) {
    if (i % 2 === 0) continue;
    const cz = RUNWAY.cz + RUNWAY.length / 2 - ((i + 0.5) / steps) * RUNWAY.length;
    const a = project(cam, { x: RUNWAY.cx - 1.6, y: RUNWAY.elevation + 0.9, z: cz + 14 }, w, h, focal);
    const b = project(cam, { x: RUNWAY.cx + 1.6, y: RUNWAY.elevation + 0.9, z: cz + 14 }, w, h, focal);
    const c = project(cam, { x: RUNWAY.cx + 1.6, y: RUNWAY.elevation + 0.9, z: cz - 14 }, w, h, focal);
    const d2 = project(cam, { x: RUNWAY.cx - 1.6, y: RUNWAY.elevation + 0.9, z: cz - 14 }, w, h, focal);
    if (!a || !b || !c || !d2) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.fill();
  }
  // Runway numbers at each end.
  drawRunwayLabel(ctx, w, h, cam, focal, 0, RUNWAY.cz - RUNWAY.length / 2 + 60, '18');
  drawRunwayLabel(ctx, w, h, cam, focal, 0, RUNWAY.cz + RUNWAY.length / 2 - 60, '36');
}

function drawRunwayLabel(ctx, w, h, cam, focal, x, z, text) {
  const p = project(cam, { x: RUNWAY.cx + x, y: RUNWAY.elevation + 1, z }, w, h, focal);
  if (!p || p.d > 2600 || p.d < 150) return; // too far, or right under the plane
  const size = Math.max(10, Math.min(30, 90000 / p.d));
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, p.x, p.y);
}

function drawTreesAndHouses(ctx, w, h, cam, focal, scenery) {
  for (const t of scenery.trees) {
    const dx = t.x - cam.pos.x;
    const dz = t.z - cam.pos.z;
    if (dx * dx + dz * dz > 2600 * 2600) continue;
    const p = project(cam, { x: t.x, y: t.h, z: t.z }, w, h, focal);
    if (!p) continue;
    const s = Math.max(1.5, (t.s * focal) / p.d / 10);
    ctx.fillStyle = fog('#2e6b34', p.d);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s * 2.2);
    ctx.lineTo(p.x - s, p.y);
    ctx.lineTo(p.x + s, p.y);
    ctx.closePath();
    ctx.fill();
  }
  for (const hs of scenery.houses) {
    const dx = hs.x - cam.pos.x;
    const dz = hs.z - cam.pos.z;
    if (dx * dx + dz * dz > 2200 * 2200) continue;
    const p = project(cam, { x: hs.x, y: hs.h + 4, z: hs.z }, w, h, focal);
    if (!p) continue;
    const s = Math.max(2, (hs.w * focal) / p.d / 12);
    ctx.fillStyle = fog('#e8dcc8', p.d);
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s / 2);
    ctx.fillStyle = fog('#b4552d', p.d);
    ctx.beginPath();
    ctx.moveTo(p.x - s / 2, p.y - s / 2);
    ctx.lineTo(p.x, p.y - s);
    ctx.lineTo(p.x + s / 2, p.y - s / 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClouds(ctx, w, h, cam, focal, clouds, time) {
  for (const c of clouds) {
    const dx = c.x - cam.pos.x;
    const dz = c.z - cam.pos.z;
    if (dx * dx + dz * dz > 6000 * 6000) continue;
    const drift = time * 2;
    const p = project(cam, { x: c.x + drift, y: c.y, z: c.z }, w, h, focal);
    if (!p) continue;
    const r = Math.max(8, (c.r * focal) / p.d / 8);
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - r * 0.55, p.y + r * 0.08, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + r * 0.55, p.y + r * 0.06, r * 0.66, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRings(ctx, w, h, cam, focal, rings, nextIndex) {
  if (!rings) return;
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    const dist = Math.hypot(ring.x - cam.pos.x, ring.y - cam.pos.y, ring.z - cam.pos.z);
    if (dist > 3800) continue;
    const color = ring.passed ? 'rgba(120,200,140,0.55)' : i === nextIndex ? RING_NEXT : RING_COLOR;
    const glow = i === nextIndex;
    // The ring faces along the course (roughly north-south here).
    const pts = [];
    for (let k = 0; k <= 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      const px = ring.x + Math.cos(a) * ring.r;
      const py = ring.y + Math.sin(a) * ring.r;
      pts.push(project(cam, { x: px, y: py, z: ring.z }, w, h, focal));
    }
    ctx.save();
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, Math.min(10, 2600 / dist));
    ctx.beginPath();
    let pen = false;
    for (const p of pts) {
      if (!p) {
        pen = false;
        continue;
      }
      if (!pen) {
        ctx.moveTo(p.x, p.y);
        pen = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    // Number tag above the next ring.
    if (i === nextIndex) {
      const top = project(cam, { x: ring.x, y: ring.y + ring.r + 14, z: ring.z }, w, h, focal);
      if (top) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(13, Math.min(30, 8000 / dist))}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), top.x, top.y);
      }
    }
  }
}
