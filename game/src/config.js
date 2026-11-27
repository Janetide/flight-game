// Every number that tunes the game lives here, so the flight model, the
// missions and the renderer all agree on what "fast" or "low on fuel" means.

export const GAME_NAME = 'Skyline Courier';
export const PLANE_NAME = 'Kestrel K-2';

// --- flight model (metres, seconds, degrees) ---
export const MAX_SPEED = 92; // m/s at full throttle, level flight
export const CRUISE_SPEED = 62; // m/s the plane settles at with 60% throttle
export const STALL_SPEED = 30; // below this the wing stops flying
export const MAX_CLIMB_RATE = 9; // m/s at full power, best climb
export const GRAVITY_PULL = 4.5; // m/s of sink when the wing is stalled
export const ROLL_RATE = 95; // deg/s of bank at full aileron
export const PITCH_RATE = 48; // deg/s of pitch at full elevator
export const TURN_FACTOR = 0.30; // heading change per degree of bank per second
export const RUDDER_RATE = 12; // deg/s of heading from the rudder alone
export const MAX_BANK = 62; // degrees; the plane will not bank further
export const MAX_PITCH_UP = 32;
export const MAX_PITCH_DOWN = -26;
export const TAKEOFF_SPEED = 34; // wheels leave the ground above this
export const LANDING_MAX_SPEED = 48; // faster than this on touchdown: damage
export const LANDING_MAX_SINK = 4.5; // m/s of sink allowed on touchdown
export const LANDING_MAX_BANK = 12; // degrees of bank allowed on touchdown
export const BRAKE_DECEL = 14; // m/s^2 while braking on the ground

// --- fuel and damage ---
export const FUEL_CAPACITY = 100; // percent
export const FUEL_BURN_FULL = 0.16; // percent per second at full throttle
export const FUEL_BURN_IDLE = 0.03; // percent per second at idle
export const FUEL_BURN_CLIMB_EXTRA = 0.08; // extra percent per second climbing hard
export const DAMAGE_HARD_LANDING = 34;
export const DAMAGE_GROUND_STRIKE = 60;
export const DAMAGE_RING_SCRAPE = 8;

// --- world ---
export const WORLD_SEED = 20261126;
export const RUNWAY = {
  // A flat strip in the valley, pointing north (heading 0).
  cx: 0,
  cz: 600,
  heading: 0,
  length: 900,
  width: 46,
  elevation: 118,
};
export const VALLEY_HALF_WIDTH = 2600; // metres either side of the runway line
export const CEILING = 1500; // metres; above this the air gets thin and slow

// --- missions ---
export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    short: 'RINGS',
    goal: 'Fly through all 8 rings in order before the fuel runs out.',
    tip: 'Gentle banks win: a hard turn bleeds speed and the next ring is far.',
    rings: 8,
    timeLimit: 0,
    fuelStart: 100,
  },
  {
    id: 'landing',
    name: 'Valley Landing',
    short: 'LAND',
    goal: 'Take off, circle the valley and land on the runway, slow and level.',
    tip: 'Gear down, throttle back, sink under 4.5 m/s and keep the wings level.',
    rings: 0,
    timeLimit: 0,
    fuelStart: 100,
  },
  {
    id: 'courier',
    name: 'Courier Dash',
    short: 'DASH',
    goal: 'Race through 5 delivery gates before the clock runs out. Each gate adds 20 seconds.',
    tip: 'Full throttle between gates, brake early for the tight ones.',
    rings: 5,
    timeLimit: 150,
    fuelStart: 100,
  },
];

// --- look ---
export const SKY_TOP = '#2f6fd0';
export const SKY_HORIZON = '#bcd8ef';
export const SUN_COLOR = '#fff3c4';
export const PLANE_BODY = '#e8b13c';
export const PLANE_DARK = '#274b73';
export const PLANE_LIGHT = '#f6f0dd';
export const RING_COLOR = '#ffb02e';
export const RING_NEXT = '#37e08a';
export const RUNWAY_COLOR = '#3c4148';
export const HUD_GREEN = '#7dffb0';
export const HUD_AMBER = '#ffc857';
export const HUD_RED = '#ff6b5e';
