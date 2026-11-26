// The flight model: a forgiving arcade sim with real discipline in it.
// Throttle sets the speed the plane wants; pitch trades speed for height;
// a banked turn changes heading; below stall speed the wing gives up and the
// nose drops. Gentle flying is fast flying: hard banks and hard climbs bleed
// speed, so the pilot who plans ahead wins the race.

import {
  BRAKE_DECEL,
  CEILING,
  CRUISE_SPEED,
  DAMAGE_GROUND_STRIKE,
  DAMAGE_HARD_LANDING,
  FUEL_BURN_CLIMB_EXTRA,
  FUEL_BURN_FULL,
  FUEL_BURN_IDLE,
  FUEL_CAPACITY,
  GRAVITY_PULL,
  LANDING_MAX_BANK,
  LANDING_MAX_SINK,
  LANDING_MAX_SPEED,
  MAX_BANK,
  MAX_PITCH_DOWN,
  MAX_PITCH_UP,
  MAX_SPEED,
  PITCH_RATE,
  ROLL_RATE,
  RUDDER_RATE,
  STALL_SPEED,
  TAKEOFF_SPEED,
  TURN_FACTOR,
} from './config.js';
import { groundHeight, onRunway } from './terrain.js';

export function createPlane() {
  return {
    x: 0,
    y: 121, // metres above sea level; runway is at 118
    z: 1000, // start near the southern end of the runway
    heading: 0, // degrees, 0 = north (towards -z)
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: FUEL_CAPACITY,
    damage: 0,
    gearDown: true,
    braking: false,
    onGround: true,
    verticalSpeed: 0,
    crashed: false,
    crashReason: '',
    landed: false,
    hasFlown: false,
    distanceFlown: 0,
  };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function deg2rad(d) {
  return (d * Math.PI) / 180;
}

/**
 * One fixed step of the flight model. `ctl` carries the pilot's inputs for
 * this step: pitch -1..1, roll -1..1, rudder -1..1, throttleDelta, brake.
 * Returns a list of event strings for the game to announce.
 */
export function stepPlane(p, ctl, dt) {
  const events = [];
  if (p.crashed) return events;

  // --- throttle and fuel ---
  p.throttle = clamp(p.throttle + ctl.throttleDelta, 0, 1);
  if (p.fuel <= 0) p.throttle = 0;
  const climbRate = Math.sin(deg2rad(p.pitch)) * p.speed;
  const burn =
    FUEL_BURN_IDLE +
    (FUEL_BURN_FULL - FUEL_BURN_IDLE) * p.throttle +
    (climbRate > 3 ? FUEL_BURN_CLIMB_EXTRA : 0);
  p.fuel = Math.max(0, p.fuel - burn * dt);
  if (p.fuel <= 0 && !p.fuelWarning) {
    p.fuelWarning = true;
    events.push('fuel-empty');
  }

  // --- speed: throttle pulls towards its target, pitch trades height ---
  // On the ground there is no idle roll: no throttle means the plane
  // stops (otherwise it could never come to a halt after landing, and
  // the landing mission could never complete). In the air the idle
  // target is a slow glide.
  const targetSpeed = p.throttle * MAX_SPEED + (1 - p.throttle) * 8;
  const accel = p.onGround ? 26 : 14;
  const sink = Math.sin(deg2rad(p.pitch));
  let speedTarget = p.onGround ? p.throttle * MAX_SPEED : targetSpeed;
  if (!p.onGround) speedTarget -= sink * 22; // climbing costs speed, diving gains it
  const before = p.speed;
  p.speed += clamp(speedTarget - p.speed, -accel * dt, accel * dt);
  if (p.onGround && p.braking) p.speed = Math.max(0, p.speed - BRAKE_DECEL * dt);
  p.speed = Math.max(0, p.speed);

  // --- attitude: the stick commands a bank and a pitch, and the plane
  // slews to them. Holding A banks left and stays there; letting go
  // levels the wings. (Rate input here made the plane roll past the
  // bank the pilot asked for and orbit — position input is what a
  // keyboard player expects.)
  const targetRoll = ctl.roll * MAX_BANK;
  p.roll = clamp(p.roll + clamp(targetRoll - p.roll, -ROLL_RATE * dt, ROLL_RATE * dt), -MAX_BANK, MAX_BANK);
  const targetPitch = ctl.pitch >= 0 ? ctl.pitch * MAX_PITCH_UP : ctl.pitch * -MAX_PITCH_DOWN;
  p.pitch = clamp(p.pitch + clamp(targetPitch - p.pitch, -PITCH_RATE * dt, PITCH_RATE * dt), MAX_PITCH_DOWN, MAX_PITCH_UP);

  const stalled = !p.onGround && p.speed < STALL_SPEED;
  if (stalled) {
    p.pitch = Math.max(MAX_PITCH_DOWN, p.pitch - 26 * dt); // the nose drops
    if (!p.stallWarning) {
      p.stallWarning = true;
      events.push('stall');
    }
  } else if (p.speed > STALL_SPEED + 6) {
    p.stallWarning = false;
  }

  // --- heading: bank turns the plane, rudder nudges it ---
  const turnRate = p.roll * TURN_FACTOR * (p.speed / CRUISE_SPEED) + ctl.rudder * RUDDER_RATE;
  p.heading = (p.heading + turnRate * dt + 360) % 360;

  // --- motion ---
  const hdg = deg2rad(p.heading);
  const lift = p.onGround ? 0 : clamp(p.speed / (STALL_SPEED + 18), 0, 1);
  const vs = stalled
    ? -GRAVITY_PULL - (STALL_SPEED - p.speed) * 0.25
    : Math.sin(deg2rad(p.pitch)) * p.speed * lift;
  p.verticalSpeed = vs;
  const forward = p.speed * Math.cos(deg2rad(p.pitch));
  p.x += Math.sin(hdg) * forward * dt;
  p.z += -Math.cos(hdg) * forward * dt;
  p.y += vs * dt;
  p.distanceFlown += forward * dt;
  if (p.y > CEILING) {
    p.y = CEILING;
    p.speed = Math.max(p.speed - 12 * dt, STALL_SPEED + 4);
    events.push('ceiling');
  }

  // --- ground ---
  const ground = groundHeight(p.x, p.z);
  const above = p.y - ground;
  if (above <= 0) {
    const overStrip = onRunway(p.x, p.z);
    const sinkRate = -vs;
    const gentle =
      overStrip && p.gearDown && sinkRate <= LANDING_MAX_SINK && Math.abs(p.roll) <= LANDING_MAX_BANK && p.speed <= LANDING_MAX_SPEED + 6;
    if (!p.onGround && gentle) {
      // A landing the plane walks away from.
      p.onGround = true;
      p.y = ground;
      p.pitch = 0;
      p.roll = 0;
      p.verticalSpeed = 0;
      events.push('touchdown');
      if (sinkRate > 2.5 || p.speed > LANDING_MAX_SPEED) {
        p.damage += DAMAGE_HARD_LANDING * 0.5;
        events.push('hard-landing');
      }
      if (p.speed <= 6) {
        p.landed = true;
        events.push('stopped');
      }
    } else if (!p.onGround) {
      p.crashed = true;
      p.y = ground;
      p.damage = 100;
      p.crashReason = overStrip
        ? 'You hit the runway too hard. Gear down, sink gently, wings level.'
        : 'You flew into the terrain. Watch the hills — and your altitude.';
      events.push('crash');
    } else {
      p.y = ground;
      p.verticalSpeed = 0;
      // "Stopped" only counts after the plane has actually flown: at the
      // start of a sortie it sits on the runway at speed zero, which is
      // not a landing.
      if (p.onGround && p.hasFlown && p.speed <= 4 && !p.landed) {
        p.landed = true;
        events.push('stopped');
      }
    }
  } else if (p.onGround && p.speed > TAKEOFF_SPEED && p.pitch > 2) {
    p.onGround = false;
    p.hasFlown = true;
    p.landed = false;
    events.push('takeoff');
  } else if (p.onGround) {
    p.y = ground;
  }

  if (p.damage >= 100 && !p.crashed) {
    p.crashed = true;
    p.crashReason = 'The airframe gave out. Too much damage.';
    events.push('crash');
  }
  return events;
}

/** Apply a ground strike that does not destroy the plane outright. */
export function scrapeDamage(p, amount) {
  p.damage = Math.min(100, p.damage + amount);
  return p.damage >= 100;
}

export { DAMAGE_GROUND_STRIKE, DAMAGE_HARD_LANDING };
