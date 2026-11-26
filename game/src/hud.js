// The HUD: airspeed and altitude tapes, a compass tape, an artificial
// horizon, throttle / fuel / damage bars, the mission panel, the timer and
// the big centre messages. Everything is drawn lit — bright on dark — so the
// instruments read at a glance in a screenshot.

import { HUD_AMBER, HUD_GREEN, HUD_RED } from './config.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function pad(n, width) {
  return String(Math.round(n)).padStart(width, '0');
}

/** Draw the whole HUD over the scene. `view` carries the frame's numbers. */
export function drawHud(ctx, w, h, view) {
  const p = view.plane;
  const s = Math.min(w, h) / 760; // scale for text and gauges
  ctx.save();
  ctx.textBaseline = 'middle';
  drawCompassTape(ctx, w, h, p.heading, s);
  drawSpeedTape(ctx, w, h, p.speed, s, p);
  drawAltitudeTape(ctx, w, h, p.y, s, p);
  drawArtificialHorizon(ctx, w, h, p, s);
  drawBars(ctx, w, h, p, s);
  drawMissionPanel(ctx, w, h, view, s);
  drawTimer(ctx, w, h, view, s);
  drawCentreMessage(ctx, w, h, view, s);
  drawWarnings(ctx, w, h, view, s);
  ctx.restore();
}

function drawCompassTape(ctx, w, h, headingRaw, s) {
  const heading = ((headingRaw % 360) + 360) % 360;
  const y = 30 * s;
  const cx = w / 2;
  const width = Math.min(w * 0.5, 520 * s);
  ctx.fillStyle = 'rgba(8,16,26,0.55)';
  roundRect(ctx, cx - width / 2, y - 18 * s, width, 36 * s, 8 * s);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - width / 2, y - 18 * s, width, 36 * s);
  ctx.clip();
  const pxPerDeg = (width / 120) * 1;
  const labels = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let d = -60; d <= 60; d += 5) {
    const deg = ((Math.round(heading) + d) % 360 + 360) % 360;
    const x = cx + d * (width / 120);
    const major = deg % 45 === 0;
    ctx.strokeStyle = major ? '#e8f2ff' : 'rgba(232,242,255,0.45)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + (major ? 8 : 12) * s);
    ctx.lineTo(x, y + 16 * s);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#e8f2ff';
      ctx.font = `bold ${13 * s}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(labels[deg] ?? String(deg).padStart(3, '0'), x, y - 2 * s);
    }
  }
  ctx.restore();
  ctx.fillStyle = HUD_GREEN;
  ctx.beginPath();
  ctx.moveTo(cx, y + 18 * s);
  ctx.lineTo(cx - 6 * s, y + 10 * s);
  ctx.lineTo(cx + 6 * s, y + 10 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8f2ff';
  ctx.font = `bold ${15 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(pad(heading, 3) + '°', cx, y + 34 * s);
}

function drawSpeedTape(ctx, w, h, speed, s, plane) {
  const x = 18 * s;
  const y = h * 0.5;
  const height = 260 * s;
  ctx.fillStyle = 'rgba(8,16,26,0.55)';
  roundRect(ctx, x, y - height / 2, 74 * s, height, 8 * s);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y - height / 2, 74 * s, height);
  ctx.clip();
  const kmh = speed * 3.6;
  const step = 20;
  const pxPer = height / 120;
  for (let v = Math.floor((kmh - 60) / step) * step; v <= kmh + 60; v += step) {
    if (v < 0) continue;
    const yy = y - (v - kmh) * pxPer;
    ctx.strokeStyle = 'rgba(232,242,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x + 8 * s, yy);
    ctx.lineTo(x + 20 * s, yy);
    ctx.stroke();
    ctx.fillStyle = '#e8f2ff';
    ctx.font = `${12 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(String(v), x + 24 * s, yy);
  }
  ctx.restore();
  ctx.fillStyle = plane.speed < 30 && !plane.onGround ? HUD_RED : HUD_GREEN;
  roundRect(ctx, x - 4 * s, y - 15 * s, 82 * s, 30 * s, 6 * s);
  ctx.fill();
  ctx.fillStyle = '#06121d';
  ctx.font = `bold ${17 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(kmh)), x + 37 * s, y + 1 * s);
  ctx.fillStyle = '#9fb6cc';
  ctx.font = `${11 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('km/h', x + 37 * s, y - height / 2 - 12 * s);
}

function drawAltitudeTape(ctx, w, h, alt, s, plane) {
  const x = w - 92 * s;
  const y = h * 0.5;
  const height = 260 * s;
  ctx.fillStyle = 'rgba(8,16,26,0.55)';
  roundRect(ctx, x, y - height / 2, 74 * s, height, 8 * s);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y - height / 2, 74 * s, height);
  ctx.clip();
  const step = 50;
  const pxPer = height / 400;
  for (let v = Math.floor((alt - 200) / step) * step; v <= alt + 200; v += step) {
    if (v < 0) continue;
    const yy = y - (v - alt) * pxPer;
    ctx.strokeStyle = 'rgba(232,242,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(x + 54 * s, yy);
    ctx.lineTo(x + 66 * s, yy);
    ctx.stroke();
    ctx.fillStyle = '#e8f2ff';
    ctx.font = `${12 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(String(v), x + 50 * s, yy);
  }
  ctx.restore();
  ctx.fillStyle = HUD_GREEN;
  roundRect(ctx, x - 4 * s, y - 15 * s, 82 * s, 30 * s, 6 * s);
  ctx.fill();
  ctx.fillStyle = '#06121d';
  ctx.font = `bold ${17 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(alt)), x + 37 * s, y + 1 * s);
  ctx.fillStyle = '#9fb6cc';
  ctx.font = `${11 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ALT m', x + 37 * s, y - height / 2 - 12 * s);
  // Vertical speed arrow under the altitude box.
  const vs = plane.verticalSpeed;
  if (Math.abs(vs) > 0.5) {
    ctx.fillStyle = vs > 0 ? HUD_GREEN : HUD_AMBER;
    ctx.font = `bold ${14 * s}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText((vs > 0 ? '▲ +' : '▼ ') + Math.abs(vs).toFixed(1) + ' m/s', x + 37 * s, y + height / 2 + 18 * s);
  }
}

function drawArtificialHorizon(ctx, w, h, plane, s) {
  // Bottom-right, clear of the plane, the tapes and the bars.
  const cx = w - 118 * s;
  const cy = h - 148 * s;
  const r = 52 * s;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate((-plane.roll * Math.PI) / 180);
  const pitchPx = clamp(plane.pitch, -30, 30) * (r / 30);
  ctx.fillStyle = '#2f6fd0';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  for (const p of [-20, -10, 10, 20]) {
    const yy = -p * (r / 30);
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, yy);
    ctx.lineTo(r * 0.5, yy);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#e8f2ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings marker.
  ctx.fillStyle = HUD_AMBER;
  ctx.beginPath();
  ctx.moveTo(cx - 6 * s, cy);
  ctx.lineTo(cx + 6 * s, cy);
  ctx.lineTo(cx, cy + 5 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9fb6cc';
  ctx.font = `${11 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r + 14 * s);
}

function drawBars(ctx, w, h, plane, s) {
  const y = h - 26 * s;
  const x = 18 * s;
  // Throttle.
  bar(ctx, x, y - 44 * s, 190 * s, 14 * s, plane.throttle, '#37e08a', 'THR ' + Math.round(plane.throttle * 100) + '%', s);
  // Fuel.
  const fuelColor = plane.fuel < 20 ? HUD_RED : plane.fuel < 45 ? HUD_AMBER : HUD_GREEN;
  bar(ctx, x, y - 22 * s, 190 * s, 14 * s, plane.fuel / 100, fuelColor, 'FUEL ' + Math.round(plane.fuel) + '%', s);
  // Damage (fills as damage grows).
  bar(ctx, x, y, 190 * s, 14 * s, plane.damage / 100, plane.damage > 60 ? HUD_RED : HUD_AMBER, 'DMG ' + Math.round(plane.damage) + '%', s);
  // Gear and brake state.
  ctx.fillStyle = '#e8f2ff';
  ctx.font = `bold ${13 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(
    'GEAR ' + (plane.gearDown ? 'DOWN' : 'UP') + (plane.braking ? '   BRAKE' : '') + (plane.onGround ? '   ON GROUND' : ''),
    x,
    y - 62 * s,
  );
}

function bar(ctx, x, y, width, height, frac, color, label, s) {
  ctx.fillStyle = 'rgba(8,16,26,0.6)';
  roundRect(ctx, x, y, width, height, 5 * s);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x + 1, y + 1, Math.max(0, (width - 2) * clamp(frac, 0, 1)), height - 2, 4 * s);
  ctx.fill();
  ctx.fillStyle = '#e8f2ff';
  ctx.font = `bold ${11 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(label, x + width + 10 * s, y + height / 2 + 1);
}

function drawMissionPanel(ctx, w, h, view, s) {
  const x = 18 * s;
  const y = 64 * s;
  ctx.fillStyle = 'rgba(8,16,26,0.55)';
  roundRect(ctx, x, y, 300 * s, 86 * s, 8 * s);
  ctx.fill();
  ctx.fillStyle = HUD_AMBER;
  ctx.font = `bold ${14 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(view.mission.name.toUpperCase(), x + 12 * s, y + 20 * s);
  ctx.fillStyle = '#e8f2ff';
  ctx.font = `${13 * s}px system-ui, sans-serif`;
  ctx.fillText(view.objective, x + 12 * s, y + 42 * s);
  ctx.fillStyle = HUD_GREEN;
  ctx.font = `bold ${13 * s}px system-ui, sans-serif`;
  ctx.fillText(view.progress, x + 12 * s, y + 66 * s);
}

function drawTimer(ctx, w, h, view, s) {
  if (!view.timeLeft && view.timeLeft !== 0) return;
  const text = 'TIME ' + formatTime(view.timeLeft);
  ctx.fillStyle = view.timeLeft < 30 ? HUD_RED : '#e8f2ff';
  ctx.font = `bold ${22 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(text, w - 18 * s, 84 * s);
  ctx.fillStyle = '#9fb6cc';
  ctx.font = `${12 * s}px system-ui, sans-serif`;
  ctx.fillText('SCORE ' + view.score, w - 18 * s, 108 * s);
}

function formatTime(sec) {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.floor(Math.max(0, sec) % 60);
  return m + ':' + String(s).padStart(2, '0');
}

function drawCentreMessage(ctx, w, h, view, s) {
  if (!view.message) return;
  ctx.save();
  ctx.globalAlpha = clamp(view.messageAlpha ?? 1, 0, 1);
  ctx.fillStyle = view.messageColor || '#ffffff';
  ctx.font = `bold ${34 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 12;
  ctx.fillText(view.message, w / 2, h * 0.32);
  if (view.subMessage) {
    ctx.font = `${17 * s}px system-ui, sans-serif`;
    ctx.fillText(view.subMessage, w / 2, h * 0.32 + 30 * s);
  }
  ctx.restore();
}

function drawWarnings(ctx, w, h, view, s) {
  const p = view.plane;
  const warns = [];
  if (p.fuel > 0 && p.fuel < 20) warns.push('LOW FUEL');
  if (!p.onGround && p.speed < 30) warns.push('STALL');
  if (p.damage > 60) warns.push('HEAVY DAMAGE');
  if (warns.length === 0) return;
  ctx.fillStyle = HUD_RED;
  ctx.font = `bold ${18 * s}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(warns.join('   •   '), w / 2, h - 18 * s);
}

function roundRect(ctx, x, y, width, height, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
