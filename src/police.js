// The wanted system: heat rises with crimes, falls when the player lies low.
// Police cars chase and ram; foot cops chase and arrest.
import { CAR_KINDS, CAR_RADIUS, WANTED_DECAY, WANTED_MAX } from './config.js';
import { createCar, stepCar } from './traffic.js';
import { makeRng } from './random.js';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createWanted() {
  return { heat: 0, stars: 0, quietT: 0 };
}

export function updateWanted(game, dt) {
  const w = game.wanted;
  w.stars = clamp(Math.floor(w.heat), 0, WANTED_MAX);
  const seen = game.policeCars.some((c) => Math.hypot(c.x - game.player.x, c.y - game.player.y) < 520)
    || game.cops.some((c) => c.alive && Math.hypot(c.x - game.player.x, c.y - game.player.y) < 420);
  if (!seen) {
    w.quietT += dt;
    if (w.quietT > 8 && w.heat > 0) w.heat = Math.max(0, w.heat - WANTED_DECAY * dt);
  } else {
    w.quietT = 0;
  }
  if (w.stars >= 1) game.audio.startSiren();
  else game.audio.stopSiren();
}

export function createPolice(city, seed) {
  const rng = makeRng(seed + 991);
  const cars = [];
  const cops = [];

  function edgeSpawn(near) {
    // Pick a road point on the map edge nearest the player, just off-screen.
    const p = city.randomRoadPoint();
    const dx = p.x - near.x;
    const dy = p.y - near.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 200) return null;
    const edge = 560 + rng.range(0, 200);
    const scale = edge / Math.max(1, dist);
    return { x: near.x + dx * scale, y: near.y + dy * scale };
  }

  function spawnPoliceCar(game) {
    const spot = edgeSpawn(game.player);
    if (!spot) return null;
    const near = city.nearestRoadPoint(spot.x, spot.y);
    const car = createCar(near.x, near.y, near.angle, 'police');
    car.driver = 'police';
    car.cruise = 300;
    cars.push(car);
    return car;
  }

  function spawnCop(game) {
    // A sidewalk spot a few blocks from the player, never on top of them.
    let near = null;
    for (let tries = 0; tries < 8; tries += 1) {
      const cand = city.sidewalkPoint();
      const d = Math.hypot(cand.x - game.player.x, cand.y - game.player.y);
      if (d > 320 && d < 950) {
        near = cand;
        break;
      }
    }
    if (!near) return null;
    const cop = {
      x: near.x,
      y: near.y,
      angle: 0,
      speed: 132 + game.wanted.stars * 10,
      health: 60,
      alive: true,
      arrestT: 0,
    };
    cops.push(cop);
    return cop;
  }

  function updatePoliceCar(car, game, dt) {
    if (car.exploded) return;
    const p = game.player;
    const target = p.inCar || p;
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    const diff = wrapAngle(wantAngle - car.angle);
    // Stuck against a building: back up and swing around it.
    car.stuckT = (car.stuckT || 0) + dt;
    if (car.stuckT > 1) {
      const moved = Math.hypot(car.x - (car.lastX ?? car.x), car.y - (car.lastY ?? car.y));
      car.lastX = car.x;
      car.lastY = car.y;
      car.stuckT = 0;
      if (moved < 12 && dist > 80) car.backupT = 0.9;
    }
    let steer = clamp(diff * 2.4, -1, 1);
    let throttle = 1;
    if (car.backupT > 0) {
      car.backupT -= dt;
      throttle = -1;
      steer = 1;
    } else if (dist < 60) {
      throttle = 0.4;
    }
    stepCar(car, { throttle, steer, brake: false }, dt, game.city);
    car.speed = clamp(car.speed, -60, CAR_KINDS.police.top);
    if (p.inCar && dist < CAR_RADIUS * 2 + 6 && Math.abs(car.speed) > 60) {
      p.inCar.hp -= 12 * dt * 4;
      p.inCar.speed *= 0.96;
      if (Math.random() < dt * 8) game.audio.crash();
      if (p.inCar.hp <= 0) {
        p.inCar.exploded = true;
        p.inCar.speed = 0;
      }
    }
  }

  function updateCop(cop, game, dt) {
    if (!cop.alive) return;
    const p = game.player;
    if (p.inCar) {
      // On foot the cop cannot catch a car: fall back and wait near the car.
      cop.arrestT = 0;
      return;
    }
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (dist > 30) {
      const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      if (!game.city.blocksMovement(nx, cop.y, 10)) cop.x = nx;
      if (!game.city.blocksMovement(cop.x, ny, 10)) cop.y = ny;
      cop.arrestT = 0;
    } else {
      cop.arrestT += dt;
      if (cop.arrestT > 2.0) {
        game.busted();
      }
    }
  }

  return {
    cars,
    cops,
    update(game, dt) {
      const stars = game.wanted.stars;
      const wantCars = stars === 0 ? 0 : Math.min(4, stars);
      const livingCars = cars.filter((c) => !c.exploded).length;
      if (livingCars < wantCars) spawnPoliceCar(game);
      if (livingCars > wantCars + 1) {
        for (let i = cars.length - 1; i >= 0; i -= 1) {
          if (cars[i].exploded) cars.splice(i, 1);
        }
      }
      for (const car of cars) updatePoliceCar(car, game, dt);
      const wantCops = stars === 0 || game.player.inCar ? 0 : Math.min(3, stars);
      const livingCops = cops.filter((c) => c.alive).length;
      if (livingCops < wantCops) spawnCop(game);
      for (const cop of cops) updateCop(cop, game, dt);
      for (let i = cops.length - 1; i >= 0; i -= 1) {
        const c = cops[i];
        if (!c.alive || Math.hypot(c.x - game.player.x, c.y - game.player.y) > 1900) cops.splice(i, 1);
      }
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        const c = cars[i];
        if (c.exploded && Math.hypot(c.x - game.player.x, c.y - game.player.y) > 1900) cars.splice(i, 1);
      }
    },
  };
}
