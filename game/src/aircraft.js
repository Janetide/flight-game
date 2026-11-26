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
  // Fuselage: a tapered body with a cream belly stripe.
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
  ctx.arc(-118, 18, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37e08a';
  ctx.beginPath();
  ctx.arc(118, 18, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw the cockpit view: the nose cowling and the lit instrument panel along
 * the bottom of the screen, with the runway or rings visible above it.
 */
export function drawCockpitFrame(ctx, w, h, plane, time) {
  const panelH = Math.round(h * 0.26);
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
  // Nose cowling peeking over the panel.
  ctx.fillStyle = PLANE_BODY;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 90, h - panelH + 4);
  ctx.quadraticCurveTo(w / 2, h - panelH - 46, w / 2 + 90, h - panelH + 4);
  ctx.quadraticCurveTo(w / 2, h - panelH + 18, w / 2 - 90, h - panelH + 4);
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
  ctx.ellipse(w / 2, h - panelH - 14, 46, 10 + Math.sin(time * 30) * 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return panelH;
}
