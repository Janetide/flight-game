// Screenshot staging: ?shot=takeoff|rings|landing|cockpit (with &seed=N)
// puts the game in one real gameplay state, paints it twice and sets
// window.__shotReady so a screenshot tool knows the frame is final. These
// are the same code paths the player flies through — no special-case art.

import { createMission, missionById, stepMission } from './missions.js';
import { stepPlane } from './physics.js';
import { RUNWAY } from './config.js';

const STEP = 1 / 60;

/** Advance the mission by a fixed number of simulated steps. */
function simulate(mission, seconds, controls) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    const events = stepPlane(mission.plane, controls, STEP);
    stepMission(mission, STEP, mission.timeFlown, events);
    if (mission.plane.crashed) break;
  }
}

function fullThrottle() {
  return { pitch: 0, roll: 0, rudder: 0, throttleDelta: 0, brake: false };
}

/**
 * Build the staged state for one named shot. Returns
 * { mission, cameraMode } for the renderer, or null for an unknown shot.
 */
export function stageShot(name, seed) {
  if (name === 'takeoff') {
    const mission = createMission(missionById('landing'), seed);
    mission.plane.throttle = 0.85;
    simulate(mission, 2.2, { ...fullThrottle(), throttleDelta: 0 });
    // Rolling down the runway at speed, nose just starting to lift.
    mission.plane.throttle = 0.85;
    return { mission, cameraMode: 'chase' };
  }
  if (name === 'rings') {
    const mission = createMission(missionById('rings'), seed);
    const p = mission.plane;
    // Hero moment: on final over the runway, gear down, with the first
    // ring dead ahead beyond the strip — aircraft, runway and target ring
    // in one frame, instead of a ring alone over empty green.
    p.x = 60;
    p.y = 205;
    p.z = 850;
    p.heading = 2;
    p.pitch = -3;
    p.roll = 1;
    p.speed = 46;
    p.throttle = 0.35;
    p.onGround = false;
    p.gearDown = true;
    mission.timeFlown = 150;
    mission.score = 50;
    return { mission, cameraMode: 'chase' };
  }
  if (name === 'landing') {
    const mission = createMission(missionById('landing'), seed);
    const p = mission.plane;
    // Low on final, wheels nearly down: the runway fills the frame and
    // the valley, river and town read behind it.
    p.x = 40;
    p.y = 170;
    p.z = 1200;
    p.heading = 2;
    p.pitch = -4;
    p.roll = 1;
    p.speed = 42;
    p.throttle = 0.28;
    p.onGround = false;
    p.gearDown = true;
    mission.timeFlown = 190;
    mission.score = 50;
    return { mission, cameraMode: 'chase' };
  }
  if (name === 'cockpit') {
    const mission = createMission(missionById('rings'), seed);
    const p = mission.plane;
    // Low over the meadow at speed, cockpit view, instruments lit, the
    // second ring lined up ahead — same leg as the cover shot.
    const target = mission.rings[1];
    const from = mission.rings[0];
    const legDx = target.x - from.x;
    const legDz = target.z - from.z;
    const legLen = Math.hypot(legDx, legDz);
    const ux = legDx / legLen;
    const uz = legDz / legLen;
    p.x = target.x - ux * 320;
    p.y = target.y - 55;
    p.z = target.z - uz * 320;
    p.heading = ((Math.atan2(ux, -uz) * 180) / Math.PI + 360) % 360;
    p.pitch = 0;
    p.roll = 6;
    p.speed = 74;
    p.throttle = 0.85;
    p.onGround = false;
    mission.rings[0].passed = true;
    mission.nextRing = 1;
    mission.ringsPassed = 1;
    mission.score = 250;
    mission.timeFlown = 31;
    return { mission, cameraMode: 'cockpit' };
  }
  return null;
}

/** Distance from the plane to the runway threshold, for the landing shot. */
export function runwayDistance(plane) {
  return Math.hypot(plane.x - RUNWAY.cx, plane.z - (RUNWAY.cz - RUNWAY.length / 2));
}
