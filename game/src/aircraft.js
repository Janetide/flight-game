// The Kestrel K-2, drawn in canvas paths, and the camera that follows it.
// Chase view: the camera sits behind and above the plane, looking forward
// along its heading, so the pilot sees the aircraft, the terrain ahead and
// the next ring or runway. Cockpit view: the camera sits at the nose and the
// panel fills the bottom of the screen.

import { PLANE_BODY, PLANE_DARK, PLANE_LIGHT } from './config.js';

function deg2rad(d) {
  return (d * Math.PI) / 180;
}

/**
 * Camera basis vectors from the plane's attitude. `mode` is 'chase' or
 * 'cockpit'. Returns { pos, forward, right, up } in world space.
 */
export function cameraFor(plane, mode) {
  const hdg = deg2rad(plane.heading);
  const pitch = deg2rad(plane.pitch);
  const roll = deg2rad(plane.roll);
  const forward = {
    x: Math.sin(hdg) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(hdg) * Math.cos(pitch),
  };
  const rightBase = { x: Math.cos(hdg), y: 0, z: Math.sin(hdg) };
  const upBase = {
    x: -Math.sin(hdg) * Math.sin(pitch),
    y: Math.cos(pitch),
    z: Math.cos(hdg) * Math.sin(pitch),
  };
  const cosR = Math.cos(roll);
  const sinR = Math.sin(roll);
  const right = {
    x: rightBase.x * cosR - upBase.x * sinR,
    y: rightBase.y * cosR - upBase.y * sinR,
    z: rightBase.z * cosR - upBase.z * sinR,
  };
  const up = {
    x: upBase.x * cosR + rightBase.x * sinR,
    y: upBase.y * cosR + rightBase.y * sinR,
    z: upBase.z * cosR + rightBase.z * sinR,
  };
  let pos;
  if (mode === 'cockpit') {
    pos = {
      x: plane.x + forward.x * 3.2,
      y: plane.y + 1.4,
      z: plane.z + forward.z * 3.2,
    };
  } else {
    const back = 26;
    const above = 7.5;
    pos = {
      x: plane.x - forward.x * back,
      y: plane.y + above,
      z: plane.z - forward.z * back,
    };
    // Keep the camera out of the hills when the plane is low.
    if (pos.y < plane.y + 3) pos.y = plane.y + 3;
  }
  return { pos, forward, right, up };
}

/** Where the plane sits on screen in chase view (a little below centre). */
export function planeScreenPos(w, h) {
  return { x: w / 2, y: h * 0.56 };
}

/**
 * Draw the Kestrel in chase view at (x, y), banked by `roll` degrees and
 * scaled by `scale`. The prop spins with `time`.
 */
export function drawPlaneChase(ctx, x, y, roll, scale, time, throttle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(deg2rad(roll));
  ctx.scale(scale, scale);
  // Prop blur disc.
  const spin = 0.35 + throttle * 0.65;
  ctx.save();
  ctx.globalAlpha = 0.16 + spin * 0.1;
  ctx.fillStyle = '#dfe6ee';
  ctx.beginPath();
  ctx.ellipse(0, -52, 30 + Math.sin(time * 40) * 2, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Tailplane and fin.
  ctx.fillStyle = PLANE_DARK;
  ctx.beginPath();
  ctx.moveTo(-34, 26);
  ctx.lineTo(-8, 12);
  ctx.lineTo(8, 12);
  ctx.lineTo(34, 26);
  ctx.lineTo(30, 32);
  ctx.lineTo(-30, 32);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-3, 30);
  ctx.lineTo(-2, 2);
  ctx.lineTo(2, 2);
  ctx.lineTo(6, 30);
  ctx.closePath();
  ctx.fill();
  // Wings: a long low wing with a slight dihedral, amber on top.
  ctx.fillStyle = PLANE_BODY;
  ctx.beginPath();
  ctx.moveTo(-118, 14);
  ctx.quadraticCurveTo(-60, 2, -14, 6);
  ctx.lineTo(14, 6);
  ctx.quadraticCurveTo(60, 2, 118, 14);
  ctx.lineTo(112, 26);
  ctx.quadraticCurveTo(0, 20, -112, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PLANE_DARK;
  ctx.beginPath();
  ctx.moveTo(-118, 14);
  ctx.lineTo(-112, 26);
  ctx.lineTo(-100, 24);
  ctx.lineTo(-104, 15);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(118, 14);
  ctx.lineTo(112, 26);
  ctx.lineTo(100, 24);
  ctx.lineTo(104, 15);
  ctx.closePath();
  ctx.fill();
  // Fuselage: a tapered body with a cream belly stripe and a dark
  // cheatline down each side, so the body reads as built, not flat.
  ctx.fillStyle = PLANE_BODY;
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.quadraticCurveTo(13, -30, 11, 6);
  ctx.quadraticCurveTo(10, 28, 0, 34);
  ctx.quadraticCurveTo(-10, 28, -11, 6);
  ctx.quadraticCurveTo(-13, -30, 0, -56);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PLANE_LIGHT;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.quadraticCurveTo(8, -28, 7, 4);
  ctx.quadraticCurveTo(6, 24, 0, 30);
  ctx.quadraticCurveTo(-6, 24, -7, 4);
  ctx.quadraticCurveTo(-8, -28, 0, -52);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PLANE_DARK;
  ctx.beginPath();
  ctx.moveTo(-11, -6);
  ctx.quadraticCurveTo(-12, 12, -8, 26);
  ctx.lineTo(-5, 25);
  ctx.quadraticCurveTo(-8, 10, -8, -6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(11, -6);
  ctx.quadraticCurveTo(12, 12, 8, 26);
  ctx.lineTo(5, 25);
  ctx.quadraticCurveTo(8, 10, 8, -6);
  ctx.closePath();
  ctx.fill();
  // Wingtip stripes, so the span reads at a glance.
  ctx.fillStyle = PLANE_LIGHT;
  ctx.fillRect(-112, 12, 12, 10);
  ctx.fillRect(100, 12, 12, 10);
  // Canopy.
  ctx.fillStyle = '#9fd4ef';
  ctx.beginPath();
  ctx.ellipse(0, -34, 6.5, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-2, -38, 2.2, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Spinner and prop blades.
  ctx.fillStyle = PLANE_DARK;
  ctx.beginPath();
  ctx.arc(0, -56, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,40,55,0.85)';
  ctx.lineWidth = 3;
  const a = time * 22 * spin;
  ctx.beginPath();
  ctx.moveTo(0, -56);
  ctx.lineTo(Math.cos(a) * 30, -56 + Math.sin(a) * 30);
  ctx.moveTo(0, -56);
  ctx.lineTo(Math.cos(a + Math.PI) * 30, -56 + Math.sin(a + Math.PI) * 30);
  ctx.stroke();
  // Navigation lights.
  ctx.fillStyle = '#ff5a4e';
  ctx.beginPath();
  ctx.arc(-118, 18, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37e08a';
  ctx.beginPath();
  ctx.arc(118, 18, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * One lit panel gauge: a dark face, a green arc, tick marks and a needle
 * driven by `frac` (0..1). `label` sits under the face.
 */
function drawGauge(ctx, cx, cy, r, frac, label) {
  ctx.save();
  ctx.fillStyle = '#0a121b';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,242,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = '#37e08a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1, frac)));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,242,255,0.65)';
  ctx.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const a = Math.PI * 0.75 + (k / 4) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
    ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
    ctx.stroke();
  }
  const na = Math.PI * 0.75 + Math.PI * 1.5 * Math.max(0, Math.min(1, frac));
  ctx.strokeStyle = '#ffc857';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(na) * (r - 6), cy + Math.sin(na) * (r - 6));
  ctx.stroke();
  ctx.fillStyle = '#e8f2ff';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9fb6cc';
  ctx.font = `bold ${Math.max(9, r * 0.28)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r + 13);
  ctx.restore();
}

/**
 * Draw the cockpit view: the nose cowling and the lit instrument panel along
 * the bottom of the screen, with the runway or rings visible above it.
 */
export function drawCockpitFrame(ctx, w, h, plane, time) {
  const panelH = Math.round(h * 0.21);
  // Panel body.
  const grad = ctx.createLinearGradient(0, h - panelH, 0, h);
  grad.addColorStop(0, '#1c2733');
  grad.addColorStop(1, '#0d141c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - panelH, w, panelH);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h - panelH + 0.5);
  ctx.lineTo(w, h - panelH + 0.5);
  ctx.stroke();
  // Lit instruments: six gauges across the panel, three each side of the
  // nose cowling, each driven by the plane's own numbers, so the cockpit
  // reads as flown, not drawn. They sit high in the panel, clear of the
  // throttle/fuel/damage bars at the bottom left and of the attitude
  // gauge at the bottom right.
  const gy = h - panelH + 36;
  const gr = Math.min(24, panelH * 0.28);
  const gauges = [
    { label: 'SPD', frac: plane.speed / 92 },
    { label: 'ALT', frac: plane.y / 600 },
    { label: 'HDG', frac: ((plane.heading % 360) + 360) % 360 / 360 },
    { label: 'RPM', frac: plane.throttle },
    { label: 'FUEL', frac: plane.fuel / 100 },
    { label: 'VSI', frac: Math.max(0, Math.min(1, 0.5 + plane.verticalSpeed / 12)) },
  ];
  gauges.forEach((g, i) => {
    // Left group: 3 gauges; right group: 3 gauges; the cowling owns the middle.
    const group = i < 3 ? 0 : 1;
    const within = i % 3;
    const cx = group === 0
      ? w * 0.22 + (w * 0.16 * (within + 0.5)) / 3
      : w * 0.62 + (w * 0.16 * (within + 0.5)) / 3;
    drawGauge(ctx, cx, gy, gr, g.frac, g.label);
  });
  // Nose cowling peeking over the panel.
  ctx.fillStyle = PLANE_BODY;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 115, h - panelH + 4);
  ctx.quadraticCurveTo(w / 2, h - panelH - 54, w / 2 + 115, h - panelH + 4);
  ctx.quadraticCurveTo(w / 2, h - panelH + 20, w / 2 - 115, h - panelH + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PLANE_DARK;
  ctx.beginPath();
  ctx.arc(w / 2, h - panelH - 8, 7, 0, Math.PI * 2);
  ctx.fill();
  // Prop blur in front of the nose.
  ctx.save();
  ctx.globalAlpha = 0.12 + plane.throttle * 0.08;
  ctx.fillStyle = '#dfe6ee';
  ctx.beginPath();
  ctx.ellipse(w / 2, h - panelH - 14, 58, 10 + Math.sin(time * 30) * 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return panelH;
}
