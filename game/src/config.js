// Palmera Bay tuning: world geometry, physics and palette in one place.
export const SEED = 1337;

// World size in pixels. Avenues run north-south, streets east-west.
export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const PITCH = 300; // distance between neighbouring road centrelines
export const ROAD_W = 72;
export const ROAD_HALF = ROAD_W / 2;
export const SIDEWALK = 14; // walkable strip between a road edge and a block
export const BEACH_Y = 2380; // sand starts here
export const WATER_Y = 2520; // sea starts here

// Population targets (kept sane so the frame stays smooth).
export const TRAFFIC_TARGET = 24;
export const PED_TARGET = 42;
export const PARKED_TARGET = 6;

// On foot.
export const WALK_SPEED = 150;
export const RUN_SPEED = 245;
export const PLAYER_RADIUS = 13;
export const PLAYER_HEALTH = 100;

// Cars.
export const CAR_RADIUS = 17;
export const CAR_ACCEL = 300;
export const CAR_BRAKE = 520;
export const CAR_REVERSE_MAX = 130;
export const CAR_DRAG = 0.35; // per second, fraction of speed lost with no input
export const CAR_TURN = 2.7; // radians per second at full steer, scaled by speed
export const CAR_KINDS = {
  sedan: { top: 380, accel: 300, color: '#c94f4f' },
  taxi: { top: 360, accel: 300, color: '#e8b93c' },
  sports: { top: 520, accel: 380, color: '#3fa7d6' },
  truck: { top: 300, accel: 240, color: '#7d8a99' },
  van: { top: 330, accel: 260, color: '#8a6fb8' },
  police: { top: 470, accel: 360, color: '#2b3a55' },
};

// Combat.
export const PISTOL_MAG = 12;
export const PISTOL_RESERVE = 60;
export const PISTOL_RANGE = 430;
export const PISTOL_DAMAGE = 34;
export const PUNCH_RANGE = 36;
export const PUNCH_DAMAGE = 22;
export const PUNCH_TIME = 0.35;

// Wanted level.
export const WANTED_MAX = 5;
export const CRIME_STEAL = 1.0;
export const CRIME_HIT_PED = 1.5;
export const CRIME_SHOT = 0.34;
export const CRIME_RAM_COP = 1.0;
export const WANTED_DECAY = 0.03; // heat per second while quiet and unseen

// Palette: a sun-soaked coastal city, top-down.
export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#6d9c4c',
  road: '#3d4148',
  roadEdge: '#2e3138',
  lane: '#d8d2a8',
  sidewalk: '#b9b3a4',
  sand: '#e3cd96',
  water: '#2f7fb8',
  waterDeep: '#256a9e',
  building: '#c9b8a3',
  building2: '#b7a58f',
  building3: '#9fb3c8',
  roof: '#8a6f5c',
  park: '#5f9e4e',
  tree: '#3e7a34',
  hudBg: 'rgba(10, 14, 22, 0.72)',
  hudText: '#f2ede2',
  hudDim: '#b9b3a4',
  star: '#ffd34d',
  marker: '#ffd34d',
  police: '#4d8fd6',
};
