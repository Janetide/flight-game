// The three missions. Each one sets up the world (rings or gates, the
// plane's starting place) and then, every frame, checks whether the pilot
// has done the thing it asks for. A mission is complete when its goal is
// met; it is failed when the fuel runs out, the clock runs out or the plane
// is wrecked.

import { MISSIONS } from './config.js';
import { gateCourse, ringCourse } from './terrain.js';
import { createPlane } from './physics.js';
import { RUNWAY } from './config.js';

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0];
}

/** Fresh mission state for `mission`, with the plane on the runway. */
export function createMission(mission, seed) {
  const plane = createPlane();
  plane.fuel = mission.fuelStart;
  const rings = mission.id === 'rings' ? ringCourse(mission.rings, seed) : mission.id === 'courier' ? gateCourse(mission.rings, seed) : [];
  return {
    def: mission,
    plane,
    rings,
    nextRing: 0,
    score: 0,
    timeLeft: mission.timeLimit,
    timeFlown: 0,
    complete: false,
    failed: false,
    failReason: '',
    message: '',
    subMessage: '',
    messageUntil: 0,
    messageColor: '#ffffff',
    ringsPassed: 0,
    bestLanding: null,
    events: [],
  };
}

function setMessage(m, text, sub, color, now, seconds = 2.6) {
  m.message = text;
  m.subMessage = sub ?? '';
  m.messageColor = color ?? '#ffffff';
  m.messageUntil = now + seconds;
}

function headingTo(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  return (Math.atan2(dx, -dz) * 180) / Math.PI;
}

/**
 * Advance one mission step. `now` is the mission clock in seconds; `events`
 * are the flight model's event strings from this step. Returns nothing; the
 * mission object carries the result.
 */
export function stepMission(m, dt, now, events) {
  const p = m.plane;
  m.timeFlown += dt;
  if (m.def.timeLimit > 0 && !m.complete && !m.failed) {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      m.timeLeft = 0;
      m.failed = true;
      m.failReason = 'Out of time. The delivery window closed.';
    }
  }
  for (const e of events) {
    if (e === 'takeoff') {
      setMessage(m, 'AIRBORNE', 'Gear up when you are clear — G toggles the gear', '#7dffb0', now);
      m.score += 50;
    } else if (e === 'touchdown') {
      setMessage(m, 'TOUCHDOWN', '', '#7dffb0', now);
    } else if (e === 'hard-landing') {
      setMessage(m, 'HARD LANDING', 'Damage taken — sink gently next time', '#ffc857', now);
    } else if (e === 'stopped') {
      if (m.def.id === 'landing') {
        m.complete = true;
        m.score += 1000 + Math.max(0, Math.round(p.fuel)) * 5;
        setMessage(m, 'LANDED — MISSION COMPLETE', 'Score ' + m.score, '#7dffb0', now, 6);
      } else {
        setMessage(m, 'STOPPED ON THE RUNWAY', 'Press R to fly again', '#e8f2ff', now, 4);
      }
    } else if (e === 'crash') {
      m.failed = true;
      m.failReason = p.crashReason;
      setMessage(m, 'CRASHED', p.crashReason, '#ff6b5e', now, 6);
    } else if (e === 'stall') {
      setMessage(m, 'STALL!', 'Nose down, throttle up', '#ff6b5e', now, 2);
    } else if (e === 'fuel-empty') {
      setMessage(m, 'FUEL EMPTY', 'Glide to the runway — you have one chance', '#ff6b5e', now, 4);
    }
  }
  if (m.complete || m.failed) return;

  if (m.fuel <= 0 && m.plane.onGround && m.plane.speed < 2 && m.def.id !== 'landing') {
    m.failed = true;
    m.failReason = 'Out of fuel on the ground, short of the goal.';
  }

  // Ring and gate missions: the next ring is the one to fly through.
  if (m.rings.length > 0 && m.nextRing < m.rings.length) {
    const ring = m.rings[m.nextRing];
    const dx = p.x - ring.x;
    const dy = p.y - ring.y;
    const dz = p.z - ring.z;
    const dist = Math.hypot(dx, dy, dz);
    // Crossing the ring plane close to its centre counts as a pass.
    const prevDz = (m.prevDz ?? dz) ;
    if (dist < ring.r * 0.95 && Math.sign(dz) !== Math.sign(prevDz) && Math.abs(dz) < 60) {
      ring.passed = true;
      m.nextRing++;
      m.ringsPassed++;
      const bonus = m.def.id === 'courier' ? 300 : 200;
      m.score += bonus;
      if (m.def.id === 'courier') {
        m.timeLeft += 20;
        setMessage(m, 'GATE ' + m.ringsPassed + ' — +20s', 'Score ' + m.score, '#37e08a', now);
      } else {
        setMessage(m, 'RING ' + m.ringsPassed + ' OF ' + m.rings.length, 'Score ' + m.score, '#37e08a', now);
      }
      if (m.nextRing >= m.rings.length) {
        m.complete = true;
        const timeBonus = Math.max(0, Math.round(m.timeLeft)) * 10;
        const fuelBonus = Math.round(p.fuel) * 5;
        m.score += 1000 + timeBonus + fuelBonus;
        setMessage(m, 'MISSION COMPLETE', 'Score ' + m.score + ' — press R to fly again', '#7dffb0', now, 6);
      }
    }
    // Scraping the ring edge (close but outside the hole) costs a little.
    if (dist < ring.r * 1.25 && dist >= ring.r * 0.95 && Math.abs(dz) < 12 && !ring.scraped) {
      ring.scraped = true;
      p.damage = Math.min(100, p.damage + 8);
      setMessage(m, 'RING SCRAPE', 'Damage +8% — fly through the middle', '#ffc857', now, 2);
    }
    m.prevDz = dz;
    m.nextRingDist = dist;
    m.nextRingBearing = headingTo(p, ring);
  }

  // Landing mission: guide the pilot back to the runway.
  if (m.def.id === 'landing') {
    const dx = RUNWAY.cx - p.x;
    const dz = RUNWAY.cz - p.z;
    m.runwayDist = Math.hypot(dx, dz);
    m.runwayBearing = headingTo(p, RUNWAY);
  }
}

/** The objective line the HUD shows for this mission right now. */
export function objectiveLine(m) {
  const p = m.plane;
  if (m.def.id === 'rings' || m.def.id === 'courier') {
    if (m.nextRing >= m.rings.length) return m.def.id === 'rings' ? 'All rings flown — well done.' : 'All gates delivered.';
    const ring = m.rings[m.nextRing];
    const dist = Math.round(Math.hypot(p.x - ring.x, p.y - ring.y, p.z - ring.z));
    const label = m.def.id === 'rings' ? 'ring' : 'gate';
    return 'Fly through ' + label + ' ' + (m.nextRing + 1) + ' of ' + m.rings.length + ' — ' + dist + ' m ahead';
  }
  if (!m.plane.onGround && m.plane.y > 160) {
    const bearing = headingTo(p, { x: RUNWAY.cx, z: RUNWAY.cz });
    const diff = Math.abs(((bearing - p.heading + 540) % 360) - 180);
    if (diff < 20) return 'On final — gear down, throttle back, sink gently.';
    return 'Circle back and line up with the runway (heading ' + pad3(bearing) + ').';
  }
  if (m.plane.onGround && m.plane.speed < 2) return 'Throttle up (W) and lift off at 120 km/h.';
  return 'Land on the runway: gear down, under 170 km/h, sink under 4.5 m/s.';
}

/** The progress line the HUD shows under the objective. */
export function progressLine(m) {
  if (m.def.id === 'landing') {
    const p = m.plane;
    const dist = Math.round(Math.hypot(RUNWAY.cx - p.x, RUNWAY.cz - p.z));
    return 'Runway ' + dist + ' m away — bearing ' + pad3(headingTo(p, { x: RUNWAY.cx, z: RUNWAY.cz })) + '°';
  }
  return 'Rings ' + m.ringsPassed + '/' + m.rings.length + '   •   Score ' + m.score;
}

function pad3(n) {
  return String(Math.round(((n % 360) + 360) % 360)).padStart(3, '0');
}
