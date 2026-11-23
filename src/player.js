// The player: on foot and behind the wheel, with health, cash and weapons.
import {
  CAR_RADIUS,
  CRIME_HIT_PED,
  CRIME_SHOT,
  CRIME_STEAL,
  PISTOL_DAMAGE,
  PISTOL_MAG,
  PISTOL_RANGE,
  PISTOL_RESERVE,
  PLAYER_HEALTH,
  PLAYER_RADIUS,
  PUNCH_DAMAGE,
  PUNCH_RANGE,
  PUNCH_TIME,
  RUN_SPEED,
  WALK_SPEED,
} from './config.js';
import { stepCar } from './traffic.js';
import { missionEvent } from './missions.js';

export function createPlayer(city) {
  const s = city.spawn;
  return {
    x: s.x,
    y: s.y,
    angle: s.angle,
    health: PLAYER_HEALTH,
    armour: 0,
    cash: 250,
    weapon: 'fists',
    hasPistol: true,
    mag: PISTOL_MAG,
    reserve: PISTOL_RESERVE,
    inCar: null,
    punchAnim: 0,
    punchCd: 0,
    shootCd: 0,
    reloadT: 0,
    runT: 0,
  };
}

function nearestCar(game, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of game.cars) {
    if (car.exploded || car.driver === 'player') continue;
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

function moveOnFoot(game, dt, mx, my, speed) {
  const p = game.player;
  const len = Math.hypot(mx, my);
  if (len < 0.01) return;
  const nx = p.x + (mx / len) * speed * dt;
  const ny = p.y + (my / len) * speed * dt;
  p.angle = Math.atan2(my, mx);
  if (!game.city.blocksMovement(nx, p.y, PLAYER_RADIUS)) p.x = nx;
  if (!game.city.blocksMovement(p.x, ny, PLAYER_RADIUS)) p.y = ny;
}

// One shot toward a world point: tracer, damage, wanted heat.
export function shootAt(game, wx, wy) {
  const p = game.player;
  if (p.shootCd > 0 || p.reloadT > 0) return false;
  if (p.weapon !== 'pistol') return false;
  if (p.mag <= 0) {
    game.audio.pickup();
    return false;
  }
  p.mag -= 1;
  p.shootCd = 0.18;
  game.stats.shots += 1;
  const ox = p.inCar ? p.inCar.x : p.x;
  const oy = p.inCar ? p.inCar.y : p.y;
  const ang = Math.atan2(wy - oy, wx - ox);
  const ex = ox + Math.cos(ang) * PISTOL_RANGE;
  const ey = oy + Math.sin(ang) * PISTOL_RANGE;
  let endX = ex;
  let endY = ey;
  let bestT = 1;
  const hitTest = (tx, ty, r) => {
    const dx = tx - ox;
    const dy = ty - oy;
    const t = (dx * Math.cos(ang) + dy * Math.sin(ang)) / PISTOL_RANGE;
    if (t < 0 || t > 1) return;
    const px = ox + Math.cos(ang) * t * PISTOL_RANGE - tx;
    const py = oy + Math.sin(ang) * t * PISTOL_RANGE - ty;
    if (px * px + py * py < r * r && t < bestT) {
      bestT = t;
      endX = tx;
      endY = ty;
    }
  };
  let hitPed = null;
  let hitCop = null;
  let hitCar = null;
  for (const ped of game.peds) {
    if (ped.alive) {
      const before = bestT;
      hitTest(ped.x, ped.y, 14);
      if (bestT < before) hitPed = ped;
    }
  }
  for (const cop of game.cops) {
    if (cop.alive) {
      const before = bestT;
      hitTest(cop.x, cop.y, 14);
      if (bestT < before) hitCop = cop;
    }
  }
  for (const car of game.cars.concat(game.policeCars)) {
    if (car.exploded) continue;
    const before = bestT;
    hitTest(car.x, car.y, CAR_RADIUS + 4);
    if (bestT < before) hitCar = car;
  }
  if (hitPed) {
    hitPed.alive = false;
    hitPed.fade = 0;
    game.wanted.heat += CRIME_HIT_PED;
  }
  if (hitCop) {
    hitCop.health -= PISTOL_DAMAGE;
    if (hitCop.health <= 0) hitCop.alive = false;
    game.wanted.heat += 1;
  }
  if (hitCar) {
    hitCar.hp -= PISTOL_DAMAGE;
    if (hitCar.kind === 'police') game.wanted.heat += 1;
    if (hitCar.hp <= 0) {
      hitCar.exploded = true;
      hitCar.speed = 0;
    }
  }
  game.tracers.push({ x1: ox, y1: oy, x2: endX, y2: endY, life: 0.6 });
  game.audio.gunshot();
  game.wanted.heat += CRIME_SHOT;
  game.wanted.quietT = 0;
  // Pedestrians nearby hear the shot and run.
  for (const ped of game.peds) {
    if (ped.alive && Math.hypot(ped.x - ox, ped.y - oy) < 320) {
      ped.angle = Math.atan2(ped.y - oy, ped.x - ox);
      ped.fleeT = 1.6;
      ped.state = 'flee';
    }
  }
  return true;
}

export function punch(game) {
  const p = game.player;
  if (p.punchCd > 0 || p.inCar) return;
  p.punchAnim = PUNCH_TIME;
  p.punchCd = PUNCH_TIME + 0.1;
  game.audio.punch();
  const reach = PUNCH_RANGE + 14;
  const fx = p.x + Math.cos(p.angle) * reach;
  const fy = p.y + Math.sin(p.angle) * reach;
  for (const ped of game.peds) {
    if (!ped.alive) continue;
    if (Math.hypot(ped.x - fx, ped.y - fy) < 26) {
      ped.alive = false;
      ped.fade = 0;
      game.wanted.heat += CRIME_HIT_PED;
    }
  }
  for (const cop of game.cops) {
    if (!cop.alive) continue;
    if (Math.hypot(cop.x - fx, cop.y - fy) < 26) {
      cop.health -= PUNCH_DAMAGE;
      if (cop.health <= 0) cop.alive = false;
      game.wanted.heat += 0.5;
    }
  }
}

export function updatePlayer(game, dt) {
  const p = game.player;
  const input = game.input;
  p.punchAnim = Math.max(0, p.punchAnim - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      const need = PISTOL_MAG - p.mag;
      const take = Math.min(need, p.reserve);
      p.mag += take;
      p.reserve -= take;
    }
  }

  if (input.wasPressed('KeyE')) {
    if (p.inCar) {
      const car = p.inCar;
      car.driver = null;
      p.inCar = null;
      p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 30;
      p.angle = car.angle;
      game.audio.engineOff();
    } else {
      const car = nearestCar(game, 70);
      if (car) {
        const stealing = car.driver !== null || car.parked;
        car.driver = 'player';
        car.parked = false;
        // Roads run north-south and east-west: square the car up with the
        // road it sits on so driving straight stays on the road.
        const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        let best = dirs[0];
        let bd = Infinity;
        for (const d of dirs) {
          let diff = Math.abs(d - car.angle);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < bd) {
            bd = diff;
            best = d;
          }
        }
        car.angle = best;
        p.inCar = car;
        p.x = car.x;
        p.y = car.y;
        if (stealing) {
          game.wanted.heat += CRIME_STEAL;
          game.wanted.quietT = 0;
        }
        if (car.target) missionEvent(game, 'stoleTarget');
        game.audio.pickup();
      }
    }
  }

  if (input.wasPressed('Digit1')) p.weapon = 'fists';
  if (input.wasPressed('Digit2') && p.hasPistol) p.weapon = 'pistol';
  if (input.wasPressed('KeyR') && p.weapon === 'pistol' && p.mag < PISTOL_MAG && p.reserve > 0 && p.reloadT <= 0) {
    p.reloadT = 0.9;
  }
  if (input.wasPressed('KeyF')) punch(game);

  if (p.inCar) {
    const car = p.inCar;
    if (car.exploded) {
      p.inCar = null;
      p.health -= 15;
      p.x = car.x + 30;
      p.y = car.y;
      game.audio.crash();
      return;
    }
    const throttle = input.held('KeyW', 'ArrowUp') ? 1 : input.held('KeyS', 'ArrowDown') ? -1 : 0;
    const steer = input.held('KeyA', 'ArrowLeft') ? -1 : input.held('KeyD', 'ArrowRight') ? 1 : 0;
    const result = stepCar(car, { throttle, steer, brake: input.held('Space') }, dt, game.city);
    if (result === 'hit') game.audio.crash();
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    game.audio.engine(Math.min(1, Math.abs(car.speed) / car.top));
    // Ramming a pedestrian while driving.
    for (const ped of game.peds) {
      if (!ped.alive) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < CAR_RADIUS + 10 && Math.abs(car.speed) > 40) {
        ped.alive = false;
        ped.fade = 0;
        game.wanted.heat += CRIME_HIT_PED;
        game.wanted.quietT = 0;
        game.audio.crash();
      }
    }
    // Ramming a police car is a crime of its own.
    for (const pc of game.policeCars) {
      if (pc.exploded) continue;
      if (Math.hypot(pc.x - car.x, pc.y - car.y) < CAR_RADIUS * 2 && Math.abs(car.speed) > 80) {
        pc.hp -= 20;
        car.hp -= 10;
        game.wanted.heat += 1;
        game.wanted.quietT = 0;
        game.audio.crash();
      }
    }
    return;
  }

  game.audio.engineOff();
  const run = input.held('ShiftLeft', 'ShiftRight');
  const speed = run ? RUN_SPEED : WALK_SPEED;
  let mx = 0;
  let my = 0;
  if (input.held('KeyW', 'ArrowUp')) my -= 1;
  if (input.held('KeyS', 'ArrowDown')) my += 1;
  if (input.held('KeyA', 'ArrowLeft')) mx -= 1;
  if (input.held('KeyD', 'ArrowRight')) mx += 1;
  moveOnFoot(game, dt, mx, my, speed);
  if (mx !== 0 || my !== 0) p.runT += dt;

  // Mouse click fires the pistol toward the cursor.
  if (input.mouse.clicked && p.weapon === 'pistol' && p.reloadT <= 0) {
    const wx = game.camera.x + input.mouse.x - game.viewW / 2;
    const wy = game.camera.y + input.mouse.y - game.viewH / 2;
    shootAt(game, wx, wy);
  }
}
