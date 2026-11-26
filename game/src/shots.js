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
    // Line the plane up on the second ring: stand 380 m behind it on the
    // leg from ring 1, heading straight at it, so the ring sits centred
    // ahead with the valley behind it.
    const target = mission.rings[1];
    const from = mission.rings[0];
    const legDx = target.x - from.x;
    const legDz = target.z - from.z;
    const legLen = Math.hypot(legDx, legDz);
    const ux = legDx / legLen;
    const uz = legDz / legLen;
    p.x = target.x - ux * 380;
    p.y = target.y - 12;
    p.z = target.z - uz * 380;
    p.heading = ((Math.atan2(ux, -uz) * 180) / Math.PI + 360) % 360;
    p.pitch = 1;
    p.roll = -4;
    p.speed = 68;
    p.throttle = 0.8;
    p.onGround = false;
    mission.rings[0].passed = true;
    mission.nextRing = 1;
    mission.ringsPassed = 1;
    mission.score = 250;
    mission.timeFlown = 24;
    return { mission, cameraMode: 'chase' };
  }
  if (name === 'landing') {
    const mission = createMission(missionById('landing'), seed);
    const p = mission.plane;
    // On final approach: gear down, slow, descending onto the numbers.
    p.x = 60;
    p.y = 210;
    p.z = 1650;
    p.heading = 2;
    p.pitch = -4;
    p.roll = 1;
    p.speed = 46;
    p.throttle = 0.32;
    p.onGround = false;
    p.gearDown = true;
    mission.timeFlown = 180;
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
