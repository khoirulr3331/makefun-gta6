// Traffic cars, parked cars and pedestrians. One shared car-physics step is
// used by traffic, police and the player's own car.
import {
  BEACH_Y,
  CAR_BRAKE,
  CAR_DRAG,
  CAR_KINDS,
  CAR_RADIUS,
  CAR_REVERSE_MAX,
  CAR_TURN,
  PED_TARGET,
  TRAFFIC_TARGET,
} from './config.js';
import { makeRng } from './random.js';

const DIRS = [
  { dx: 1, dy: 0, angle: 0 }, // east
  { dx: 0, dy: 1, angle: Math.PI / 2 }, // south
  { dx: -1, dy: 0, angle: Math.PI }, // west
  { dx: 0, dy: -1, angle: -Math.PI / 2 }, // north
];

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function createCar(x, y, angle, kind) {
  const spec = CAR_KINDS[kind] || CAR_KINDS.sedan;
  return {
    x,
    y,
    angle,
    speed: 0,
    kind,
    color: spec.color,
    top: spec.top,
    accel: spec.accel,
    hp: 100,
    exploded: false,
    driver: 'traffic',
    parked: false,
    dir: 0,
    line: 0,
    nextCross: 0,
    cruise: 130 + Math.random() * 45,
    target: false,
    smoke: 0,
  };
}

// Shared physics: throttle in [-1, 1], steer in [-1, 1]. Returns 'hit' when the
// car clipped a building or the world edge this step.
export function stepCar(car, input, dt, city) {
  if (car.exploded) return 'wrecked';
  const spec = CAR_KINDS[car.kind] || CAR_KINDS.sedan;
  if (input.throttle > 0) {
    car.speed += spec.accel * input.throttle * dt;
  } else if (input.throttle < 0) {
    if (car.speed > 5) car.speed -= CAR_BRAKE * dt;
    else car.speed = Math.max(-CAR_REVERSE_MAX, car.speed + spec.accel * 0.6 * input.throttle * dt);
  } else {
    car.speed -= car.speed * CAR_DRAG * dt;
    if (Math.abs(car.speed) < 4) car.speed = 0;
  }
  if (input.brake) {
    car.speed -= Math.sign(car.speed) * CAR_BRAKE * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR_REVERSE_MAX, spec.top);
  const speedFactor = clamp(Math.abs(car.speed) / 140, 0, 1);
  car.angle += CAR_TURN * input.steer * speedFactor * Math.sign(car.speed || 1) * dt;
  car.angle = wrapAngle(car.angle);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  let hit = null;
  // Axis-separated movement: slide along walls instead of sticking.
  if (!city.blocksMovement(nx, car.y, CAR_RADIUS)) {
    car.x = nx;
  } else {
    hit = 'building';
  }
  if (!city.blocksMovement(car.x, ny, CAR_RADIUS)) {
    car.y = ny;
  } else {
    hit = 'building';
  }
  if (hit) {
    const impact = Math.abs(car.speed);
    if (impact > 60) {
      car.hp -= impact * 0.05;
      car.speed *= -0.25;
    } else {
      car.speed *= 0.4;
    }
    if (car.hp <= 0 && !car.exploded) {
      car.exploded = true;
      car.speed = 0;
    }
    return 'hit';
  }
  return 'ok';
}

function nextCrossFor(city, car) {
  const d = DIRS[car.dir];
  if (d.dx > 0) {
    for (const ax of city.avenues) if (ax > car.x + 10) return ax;
    return null;
  }
  if (d.dx < 0) {
    for (let i = city.avenues.length - 1; i >= 0; i -= 1) if (city.avenues[i] < car.x - 10) return city.avenues[i];
    return null;
  }
  if (d.dy > 0) {
    for (const sy of city.streets) if (sy > car.y + 10) return sy;
    return null;
  }
  for (let i = city.streets.length - 1; i >= 0; i -= 1) if (city.streets[i] < car.y - 10) return city.streets[i];
  return null;
}

// At an intersection: pick straight / left / right among the moves that stay
// on the road network (never drive off the grid or onto the beach).
function chooseTurn(city, car, rng) {
  const d = car.dir;
  const straight = d;
  const left = (d + 3) % 4;
  const right = (d + 1) % 4;
  const allowed = [];
  const cross = car.nextCross;
  if (d === 0) {
    // heading east: straight needs another avenue ahead
    if (city.avenues.some((ax) => ax > cross + 10)) allowed.push(straight);
    if (car.line > city.streets[0] + 10) allowed.push(left); // north exists
    if (car.line < city.streets[city.streets.length - 1] - 10) allowed.push(right); // south exists
  } else if (d === 2) {
    if (city.avenues.some((ax) => ax < cross - 10)) allowed.push(straight);
    if (car.line < city.streets[city.streets.length - 1] - 10) allowed.push(left);
    if (car.line > city.streets[0] + 10) allowed.push(right);
  } else if (d === 1) {
    if (city.streets.some((sy) => sy > cross + 10)) allowed.push(straight);
    if (car.line < city.avenues[city.avenues.length - 1] - 10) allowed.push(left);
    if (car.line > city.avenues[0] + 10) allowed.push(right);
  } else {
    if (city.streets.some((sy) => sy < cross - 10)) allowed.push(straight);
    if (car.line > city.avenues[0] + 10) allowed.push(left);
    if (car.line < city.avenues[city.avenues.length - 1] - 10) allowed.push(right);
  }
  if (allowed.length === 0) return d;
  // Mostly straight, sometimes a turn.
  const roll = rng.next();
  if (allowed.includes(straight) && roll < 0.7) return straight;
  const turns = allowed.filter((a) => a !== straight);
  if (turns.length > 0) return rng.pick(turns);
  return straight;
}

function laneTarget(city, car) {
  const d = DIRS[car.dir];
  if (d.dx !== 0) {
    // Travelling east-west along a street: keep to the right-hand side.
    return { x: car.x + d.dx * 90, y: car.line + (d.dx > 0 ? 12 : -12) };
  }
  return { x: car.line + (d.dy > 0 ? -12 : 12), y: car.y + d.dy * 90 };
}

export function createTraffic(city, seed) {
  const rng = makeRng(seed + 77);
  const cars = [];
  const peds = [];
  const pedColors = ['#d8a06a', '#7ba7d8', '#c97bb8', '#8ad07b', '#d8d06a', '#e8e8e8', '#5a6b7d'];

  function spawnTrafficCar(near) {
    const p = city.randomRoadPoint();
    if (near && Math.hypot(p.x - near.x, p.y - near.y) < 420) return null;
    const kind = rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'sports', 'truck', 'van']);
    const car = createCar(p.x, p.y, p.angle, kind);
    car.dir = p.angle === 0 ? 0 : p.angle === Math.PI / 2 ? 1 : p.angle === Math.PI ? 2 : 3;
    car.line = car.dir === 0 || car.dir === 2 ? p.y : p.x;
    car.nextCross = nextCrossFor(city, car) ?? car.line;
    car.cruise = 120 + rng.range(0, 55);
    cars.push(car);
    return car;
  }

  function spawnParkedCar() {
    // Parked along a roadside, facing along the road, so a stolen one can
    // drive straight away instead of nosing into the nearest building.
    const p = city.randomRoadPoint();
    const off = 26;
    const x = p.angle === 0 || p.angle === Math.PI ? p.x : p.x + (rng.chance(0.5) ? off : -off);
    const y = p.angle === 0 || p.angle === Math.PI ? p.y + (rng.chance(0.5) ? off : -off) : p.y;
    const kind = rng.pick(['sedan', 'sedan', 'sports', 'van']);
    const car = createCar(x, y, p.angle, kind);
    car.driver = null;
    car.parked = true;
    cars.push(car);
    return car;
  }

  function spawnPed(near) {
    const p = city.sidewalkPoint();
    if (near && Math.hypot(p.x - near.x, p.y - near.y) < 300) return null;
    const ped = {
      x: p.x,
      y: p.y,
      angle: rng.angle(),
      speed: rng.range(38, 62),
      alive: true,
      state: 'walk',
      target: city.sidewalkPoint(),
      fleeT: 0,
      color: rng.pick(pedColors),
      phase: rng.range(0, Math.PI * 2),
      fade: 0,
    };
    peds.push(ped);
    return ped;
  }

  function carAhead(car, allCars) {
    let best = null;
    let bestD = 80;
    for (const other of allCars) {
      if (other === car || other.exploded) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const dist = Math.hypot(dx, dy);
      if (dist > bestD) continue;
      const ahead = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
      if (ahead < 0) continue;
      const side = Math.abs(-Math.sin(car.angle) * dx + Math.cos(car.angle) * dy);
      if (side > 26) continue;
      best = other;
      bestD = dist;
    }
    return best;
  }

  function updateCar(car, dt, allCars) {
    if (car.parked || car.exploded) return;
    const d = DIRS[car.dir];
    const along = d.dx !== 0 ? car.x : car.y;
    if (Math.abs(along - car.nextCross) < 34) {
      const nd = chooseTurn(city, car, rng);
      car.dir = nd;
      car.line = car.nextCross;
      car.nextCross = nextCrossFor(city, car) ?? car.line;
    }
    const target = laneTarget(city, car);
    const wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
    const steer = clamp(wrapAngle(wantAngle - car.angle) * 2.2, -1, 1);
    let throttle = 1;
    const turning = Math.abs(wrapAngle(wantAngle - car.angle)) > 0.5;
    let wantSpeed = turning ? car.cruise * 0.55 : car.cruise;
    const ahead = carAhead(car, allCars);
    if (ahead) {
      const gap = Math.hypot(ahead.x - car.x, ahead.y - car.y);
      wantSpeed = Math.min(wantSpeed, Math.max(0, ahead.speed - 8));
      if (gap < 34) wantSpeed = 0;
    }
    if (car.speed > wantSpeed) throttle = -0.4;
    else if (car.speed < wantSpeed - 6) throttle = 1;
    else throttle = 0.2;
    stepCar(car, { throttle, steer, brake: wantSpeed === 0 && car.speed > 30 }, dt, city);
  }

  function updatePed(ped, dt, threat) {
    if (!ped.alive) {
      ped.fade += dt;
      return;
    }
    if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      const nx = ped.x + Math.cos(ped.angle) * 135 * dt;
      const ny = ped.y + Math.sin(ped.angle) * 135 * dt;
      if (!city.blocksMovement(nx, ped.y, 10)) ped.x = nx;
      if (!city.blocksMovement(ped.x, ny, 10)) ped.y = ny;
      return;
    }
    if (threat) {
      const dx = ped.x - threat.x;
      const dy = ped.y - threat.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 90) {
        ped.angle = Math.atan2(dy, dx);
        ped.fleeT = 1.6;
        ped.state = 'flee';
        return;
      }
    }
    const dx = ped.target.x - ped.x;
    const dy = ped.target.y - ped.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 16) {
      ped.target = city.sidewalkPoint();
      return;
    }
    ped.angle = Math.atan2(dy, dx);
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!city.blocksMovement(nx, ped.y, 10)) ped.x = nx;
    if (!city.blocksMovement(ped.x, ny, 10)) ped.y = ny;
    ped.phase += dt * 7;
  }

  return {
    cars,
    peds,
    seedInitial(near) {
      for (let i = 0; i < TRAFFIC_TARGET; i += 1) spawnTrafficCar(null);
      for (let i = 0; i < 6; i += 1) spawnParkedCar();
      for (let i = 0; i < PED_TARGET; i += 1) spawnPed(null);
      void near;
    },
    update(dt, game) {
      const allCars = game.cars.concat(game.policeCars);
      for (const car of cars) {
        if (car.driver === 'player') continue; // the player drives this one
        updateCar(car, dt, allCars);
      }
      // Keep the streets busy near the player, quiet far away.
      const alive = cars.filter((c) => !c.exploded);
      const moving = alive.filter((c) => !c.parked).length;
      if (moving < TRAFFIC_TARGET) spawnTrafficCar(game.player);
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        const c = cars[i];
        if (c.exploded && Math.hypot(c.x - game.player.x, c.y - game.player.y) > 1700) cars.splice(i, 1);
        else if (!c.parked && c.driver !== 'player' && Math.hypot(c.x - game.player.x, c.y - game.player.y) > 1800) {
          cars.splice(i, 1);
        }
      }
      const threat = game.player.inCar;
      for (const ped of peds) {
        const nearThreat = threat && Math.hypot(ped.x - threat.x, ped.y - threat.y) < 100 ? threat : null;
        updatePed(ped, dt, nearThreat);
      }
      const living = peds.filter((p) => p.alive).length;
      if (living < PED_TARGET) spawnPed(game.player);
      for (let i = peds.length - 1; i >= 0; i -= 1) {
        const p = peds[i];
        if ((!p.alive && p.fade > 4) || (p.alive && Math.hypot(p.x - game.player.x, p.y - game.player.y) > 1800)) {
          peds.splice(i, 1);
        }
      }
    },
  };
}
