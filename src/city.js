// The city of Palmera Bay: a seeded road grid with blocks, buildings, parks,
// a beach and a pier. Landmarks each own one block and never sit on a road.
import {
  BEACH_Y,
  PALETTE,
  PITCH,
  ROAD_HALF,
  SEED,
  WATER_Y,
  WORLD_H,
  WORLD_W,
} from './config.js';
import { makeRng } from './random.js';

const AVENUE_COUNT = 12; // x = 150, 450, ... 3450
const STREET_COUNT = 8; // y = 150, 450, ... 2250
const BLOCK_INSET = 18;

// Which block (column, row) holds each landmark.
const LANDMARK_BLOCKS = {
  bank: { col: 5, row: 2, label: 'BANK', color: '#d8c26a' },
  diner: { col: 2, row: 3, label: 'DINER', color: '#d67b7b' },
  garage: { col: 8, row: 1, label: "MARA'S GARAGE", color: '#7fb069' },
  mall: { col: 4, row: 5, label: 'MALL', color: '#8fa8d8' },
  hotel: { col: 9, row: 4, label: 'HOTEL', color: '#c99ad8' },
  hospital: { col: 1, row: 6, label: 'HOSPITAL', color: '#e8e8e8' },
};

function blockBounds(col, row) {
  const ax = 150 + col * PITCH;
  const ay = 150 + row * PITCH;
  return { x0: ax + ROAD_HALF, y0: ay + ROAD_HALF, x1: ax + PITCH - ROAD_HALF, y1: ay + PITCH - ROAD_HALF };
}

export function createCity(seed = SEED) {
  const rng = makeRng(seed);
  const avenues = [];
  for (let i = 0; i < AVENUE_COUNT; i += 1) avenues.push(150 + i * PITCH);
  const streets = [];
  for (let j = 0; j < STREET_COUNT; j += 1) streets.push(150 + j * PITCH);

  const buildings = [];
  const parks = [];
  const lots = [];
  const landmarks = {};

  function addBuilding(x, y, w, h, color, label) {
    const b = { x, y, w, h, cx: x + w / 2, cy: y + h / 2, color, label: label || '', shade: rng.range(0.85, 1.1) };
    buildings.push(b);
    return b;
  }

  // Normal blocks: buildings, a park, or a parking lot.
  for (let col = 0; col < AVENUE_COUNT - 1; col += 1) {
    for (let row = 0; row < STREET_COUNT - 1; row += 1) {
      const isLandmark = Object.values(LANDMARK_BLOCKS).some((l) => l.col === col && l.row === row);
      if (isLandmark) continue;
      const { x0, y0, x1, y1 } = blockBounds(col, row);
      const roll = rng.next();
      if (roll < 0.18) {
        // Park: grass with a scatter of trees.
        const trees = [];
        const n = rng.int(5, 9);
        for (let t = 0; t < n; t += 1) {
          trees.push({ x: rng.range(x0 + 16, x1 - 16), y: rng.range(y0 + 16, y1 - 16), r: rng.range(7, 12) });
        }
        parks.push({ x0, y0, x1, y1, trees });
        continue;
      }
      if (roll < 0.32) {
        // Parking lot: flat asphalt with a few parked-car slots.
        const spots = [];
        for (let s = 0; s < 5; s += 1) {
          spots.push({ x: rng.range(x0 + 30, x1 - 30), y: rng.range(y0 + 30, y1 - 30), angle: rng.pick([0, Math.PI / 2]) });
        }
        lots.push({ x0, y0, x1, y1, spots });
        continue;
      }
      const inner = { x0: x0 + BLOCK_INSET, y0: y0 + BLOCK_INSET, x1: x1 - BLOCK_INSET, y1: y1 - BLOCK_INSET };
      const iw = inner.x1 - inner.x0;
      const ih = inner.y1 - inner.y0;
      const palette = [PALETTE.building, PALETTE.building2, PALETTE.building3];
      const split = rng.next();
      if (split < 0.3) {
        addBuilding(inner.x0, inner.y0, iw, ih, rng.pick(palette));
      } else if (split < 0.75) {
        const vertical = rng.chance(0.5);
        if (vertical) {
          const cut = inner.x0 + iw * rng.range(0.4, 0.6);
          addBuilding(inner.x0, inner.y0, cut - inner.x0 - 8, ih, rng.pick(palette));
          addBuilding(cut + 8, inner.y0, inner.x1 - cut - 8, ih, rng.pick(palette));
        } else {
          const cut = inner.y0 + ih * rng.range(0.4, 0.6);
          addBuilding(inner.x0, inner.y0, iw, cut - inner.y0 - 8, rng.pick(palette));
          addBuilding(inner.x0, cut + 8, iw, inner.y1 - cut - 8, rng.pick(palette));
        }
      } else {
        const cutX = inner.x0 + iw * 0.55;
        const cutY = inner.y0 + ih * 0.5;
        addBuilding(inner.x0, inner.y0, cutX - inner.x0 - 8, ih, rng.pick(palette));
        addBuilding(cutX + 8, inner.y0, inner.x1 - cutX - 8, cutY - inner.y0 - 8, rng.pick(palette));
        addBuilding(cutX + 8, cutY + 8, inner.x1 - cutX - 8, inner.y1 - cutY - 8, rng.pick(palette));
      }
    }
  }

  // Landmarks: one big building per reserved block, door on the north sidewalk.
  for (const [name, spec] of Object.entries(LANDMARK_BLOCKS)) {
    const { x0, y0, x1, y1 } = blockBounds(spec.col, spec.row);
    const b = addBuilding(x0 + BLOCK_INSET, y0 + BLOCK_INSET, x1 - x0 - BLOCK_INSET * 2, y1 - y0 - BLOCK_INSET * 2, spec.color, spec.label);
    landmarks[name] = {
      name,
      label: spec.label,
      building: b,
      door: { x: b.cx, y: b.y - 10 },
      cx: b.cx,
      cy: b.cy,
    };
  }

  // The pier: a wooden deck from the beach out over the water, shack at the end.
  const pier = { x: 1650, y0: BEACH_Y, y1: WATER_Y + 50, w: 64 };
  const pierShack = addBuilding(pier.x - 26, WATER_Y + 8, 52, 34, '#a9805e', 'PIER');
  landmarks.pier = {
    name: 'pier',
    label: 'PIER',
    building: pierShack,
    door: { x: pier.x, y: BEACH_Y + 30 },
    cx: pier.x,
    cy: BEACH_Y + 30,
  };

  // Spatial buckets so collision checks stay cheap: one bucket per 300px cell.
  const buckets = new Map();
  function bucketKey(x, y) {
    return `${Math.floor(x / PITCH)}:${Math.floor(y / PITCH)}`;
  }
  for (const b of buildings) {
    for (let gx = Math.floor(b.x / PITCH); gx <= Math.floor((b.x + b.w) / PITCH); gx += 1) {
      for (let gy = Math.floor(b.y / PITCH); gy <= Math.floor((b.y + b.h) / PITCH); gy += 1) {
        const key = `${gx}:${gy}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(b);
      }
    }
  }

  function nearbyBuildings(x, y, r) {
    const out = [];
    const seen = new Set();
    for (let gx = Math.floor((x - r) / PITCH); gx <= Math.floor((x + r) / PITCH); gx += 1) {
      for (let gy = Math.floor((y - r) / PITCH); gy <= Math.floor((y + r) / PITCH); gy += 1) {
        const list = buckets.get(`${gx}:${gy}`);
        if (!list) continue;
        for (const b of list) {
          if (!seen.has(b)) {
            seen.add(b);
            out.push(b);
          }
        }
      }
    }
    return out;
  }

  function circleHitsBuilding(x, y, r) {
    for (const b of nearbyBuildings(x, y, r)) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  function isRoad(x, y) {
    if (x < 0 || x > WORLD_W || y < 0 || y > WORLD_H) return false;
    if (y >= BEACH_Y) return false;
    for (const ax of avenues) if (Math.abs(x - ax) < ROAD_HALF) return true;
    for (const sy of streets) if (Math.abs(y - sy) < ROAD_HALF) return true;
    return false;
  }

  // Snap a point to the nearest road centreline and say which way the road runs.
  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const ax of avenues) {
      const d = Math.abs(x - ax);
      if (d < bestD) {
        bestD = d;
        best = { x: ax, y: Math.max(ROAD_HALF, Math.min(y, BEACH_Y - ROAD_HALF)), angle: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
      }
    }
    for (const sy of streets) {
      const d = Math.abs(y - sy);
      if (d < bestD) {
        bestD = d;
        best = { x: Math.max(ROAD_HALF, Math.min(x, WORLD_W - ROAD_HALF)), y: sy, angle: rng.chance(0.5) ? 0 : Math.PI };
      }
    }
    return best;
  }

  function randomRoadPoint() {
    if (rng.chance(0.55)) {
      const ax = rng.pick(avenues);
      return { x: ax, y: rng.range(ROAD_HALF, BEACH_Y - ROAD_HALF), angle: rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2 };
    }
    const sy = rng.pick(streets);
    return { x: rng.range(ROAD_HALF, WORLD_W - ROAD_HALF), y: sy, angle: rng.chance(0.5) ? 0 : Math.PI };
  }

  function sidewalkPoint() {
    const p = randomRoadPoint();
    const off = ROAD_HALF + 10;
    if (p.angle === 0 || p.angle === Math.PI) return { x: p.x, y: p.y + (rng.chance(0.5) ? off : -off) };
    return { x: p.x + (rng.chance(0.5) ? off : -off), y: p.y };
  }

  function blocksMovement(x, y, r) {
    if (x - r < 0 || x + r > WORLD_W || y - r < 0 || y + r > WORLD_H) return true;
    if (y + r > WATER_Y) return true; // the sea stops everyone
    return circleHitsBuilding(x, y, r) !== null;
  }

  return {
    width: WORLD_W,
    height: WORLD_H,
    avenues,
    streets,
    buildings,
    parks,
    lots,
    landmarks,
    pier,
    isRoad,
    nearestRoadPoint,
    randomRoadPoint,
    sidewalkPoint,
    circleHitsBuilding,
    blocksMovement,
    spawn: { x: 750, y: 820, angle: -Math.PI / 2 },
  };
}
