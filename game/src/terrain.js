// The valley: a procedural heightfield, the flattened runway strip, the
// trees and houses dotted over it, and the clouds above it. Everything is a
// pure function of the seed, so the same seed always builds the same valley.

import { RUNWAY, VALLEY_HALF_WIDTH, WORLD_SEED } from './config.js';
import { createRandom, fbm } from './random.js';

const NOISE_SEED = WORLD_SEED;

/** Height of the bare terrain at world (x, z), in metres. */
export function baseHeight(x, z) {
  // A wide valley runs along the z axis: low in the middle, rising to
  // mountain walls on both sides and gentler hills at the far ends.
  const across = Math.abs(x) / VALLEY_HALF_WIDTH;
  const wall = Math.pow(Math.max(0, across - 0.35), 2) * 650;
  const hills = fbm(x * 0.0011, z * 0.0011, NOISE_SEED, 4) * 130;
  const bumps = fbm(x * 0.004 + 7, z * 0.004 + 3, NOISE_SEED + 55, 3) * 26;
  const endRise = Math.pow(Math.max(0, Math.abs(z - 600) / 4200), 2) * 260;
  return 118 + wall + hills + bumps + endRise;
}

/** True if the point is on the flattened runway strip. */
export function onRunway(x, z) {
  const dx = Math.abs(x - RUNWAY.cx);
  const dz = Math.abs(z - RUNWAY.cz);
  return dx < RUNWAY.width / 2 && dz < RUNWAY.length / 2;
}

/**
 * Ground height the plane can hit. The runway strip is flattened to its
 * elevation with a short blend at the edges, so the asphalt sits in the
 * valley instead of floating over the hills. The final-approach corridor
 * south of the strip (and the overshoot ground to the north) is flattened
 * the same way, so a plane on final does not meet a hill that is higher
 * than the runway it is aiming for.
 */
export function groundHeight(x, z) {
  const bare = baseHeight(x, z);
  const dx = Math.abs(x - RUNWAY.cx) / (RUNWAY.width / 2);
  const dz = Math.abs(z - RUNWAY.cz) / (RUNWAY.length / 2);
  const edge = Math.max(dx, dz);
  let ground = bare;
  if (edge < 1.6) {
    const blend = Math.max(0, Math.min(1, (edge - 1) / 0.6));
    ground = RUNWAY.elevation + (bare - RUNWAY.elevation) * blend * blend;
  }
  // Approach corridor: |x| < 220, z from 800 m north of the strip to
  // 2600 m south of it. Strongest at the centreline, fading with distance
  // from the strip so the valley floor reasserts itself further out.
  const across = Math.abs(x - RUNWAY.cx) / 220;
  if (across < 1) {
    const south = z - (RUNWAY.cz + RUNWAY.length / 2);
    const north = (RUNWAY.cz - RUNWAY.length / 2) - z;
    let along = 0;
    if (south >= 0 && south <= 1550) along = south < 450 ? 1 : 1 - (south - 450) / 1100 * 0.7;
    else if (north >= 0 && north <= 950) along = north < 300 ? 1 : 1 - (north - 300) / 650 * 0.7;
    else if (south < 0 && north < 0) along = 1; // over the strip itself
    const cf = (1 - across) * along;
    if (cf > 0) ground = Math.min(ground, RUNWAY.elevation + (ground - RUNWAY.elevation) * (1 - cf));
  }
  return ground;
}

/** Colour of the ground at a height, before fog and shading. */
export function groundColor(h, slope) {
  if (h > 620) return '#e8eef2'; // snow on the high walls
  if (h > 420) return slope > 0.35 ? '#7a6a58' : '#8a7a5c'; // rock and scree
  if (h < 132) return '#7fae62'; // valley floor, meadow green
  if (h < 220) return '#6f9e54'; // low hills
  return '#5d8a48'; // forested slopes
}

/**
 * Build the static scenery for one world: tree positions, house clusters and
 * cloud puffs, all placed by the seeded random so they never move.
 */
export function buildScenery(seed) {
  const rnd = createRandom(seed);
  const trees = [];
  for (let i = 0; i < 420; i++) {
    const x = (rnd() * 2 - 1) * (VALLEY_HALF_WIDTH + 900);
    const z = (rnd() * 2 - 1) * 5200 + 600;
    const h = baseHeight(x, z);
    if (h > 380 || h < 126) continue;
    if (onRunway(x, z)) continue;
    trees.push({ x, z, h, s: 6 + rnd() * 9 });
  }
  const houses = [];
  const townCentres = [
    { x: -420, z: 150 },
    { x: 380, z: 1150 },
    { x: -260, z: -900 },
  ];
  for (const centre of townCentres) {
    for (let i = 0; i < 14; i++) {
      const x = centre.x + (rnd() * 2 - 1) * 150;
      const z = centre.z + (rnd() * 2 - 1) * 150;
      houses.push({ x, z, h: groundHeight(x, z), w: 12 + rnd() * 10, d: 10 + rnd() * 8 });
    }
  }
  const clouds = [];
  for (let i = 0; i < 42; i++) {
    clouds.push({
      x: (rnd() * 2 - 1) * 5200,
      y: 620 + rnd() * 420,
      z: (rnd() * 2 - 1) * 5200 + 600,
      r: 90 + rnd() * 190,
    });
  }
  return { trees, houses, clouds };
}

/** Ring and gate courses, laid out over the valley in flight order. */
export function ringCourse(count, seed) {
  const rnd = createRandom(seed + 777);
  const rings = [];
  const starts = [
    { x: 0, y: 260, z: -400 },
    { x: -550, y: 330, z: -1400 },
    { x: 400, y: 300, z: -2400 },
    { x: -250, y: 420, z: -3300 },
    { x: 600, y: 380, z: -4200 },
    { x: -600, y: 460, z: -5000 },
    { x: 250, y: 340, z: -5800 },
    { x: 0, y: 280, z: -6600 },
  ];
  for (let i = 0; i < count; i++) {
    const base = starts[i % starts.length];
    const bx = base.x + (rnd() * 2 - 1) * 60;
    const bz = base.z + (rnd() * 2 - 1) * 60;
    // The valley floor rises steeply to the north, so a fixed altitude
    // would bury the later rings inside the mountains. Each ring sits
    // 55–70 m above its own ground instead.
    const by = groundHeight(bx, bz) + 55 + rnd() * 15;
    rings.push({
      x: bx,
      y: by,
      z: bz,
      r: 55,
      passed: false,
    });
  }
  return rings;
}

/** Delivery gates for the courier dash: wider, faster, lower. */
export function gateCourse(count, seed) {
  const rnd = createRandom(seed + 4242);
  const gates = [];
  const path = [
    { x: 0, y: 220, z: -600 },
    { x: -550, y: 280, z: -1800 },
    { x: 500, y: 240, z: -2900 },
    { x: -150, y: 360, z: -4100 },
    { x: 450, y: 300, z: -5200 },
  ];
  for (let i = 0; i < count; i++) {
    const base = path[i % path.length];
    const bx = base.x + (rnd() * 2 - 1) * 40;
    const bz = base.z + (rnd() * 2 - 1) * 40;
    // Same rule as the rings: sit above the local ground, not at a fixed
    // altitude — the valley floor rises to the north.
    const by = groundHeight(bx, bz) + 50 + rnd() * 12;
    gates.push({
      x: bx,
      y: by,
      z: bz,
      r: 48,
      passed: false,
    });
  }
  return gates;
}
