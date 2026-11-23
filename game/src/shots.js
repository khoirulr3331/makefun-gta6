// Screenshot scenes behind ?shot=start|play|chase|mission. Each one plays the
// real rules forward from a fresh world for a few seconds, steered by a simple
// road-following autopilot, so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { createCar, stepCar } from './traffic.js';
import { startMission } from './missions.js';

const STEP = 1 / 30;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Steer a car along the road it is already on: aim at a point ahead on the
// lane line, snapping the heading to the nearest compass direction.
function autopilotInput(game, car) {
  const city = game.city;
  const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  let best = dirs[0];
  let bd = Infinity;
  for (const d of dirs) {
    const diff = Math.abs(wrapAngle(d - car.angle));
    if (diff < bd) {
      bd = diff;
      best = d;
    }
  }
  let target;
  if (best === 0 || best === Math.PI) {
    let sy = city.streets[0];
    let sd = Infinity;
    for (const s of city.streets) {
      const dd = Math.abs(s - car.y);
      if (dd < sd) {
        sd = dd;
        sy = s;
      }
    }
    target = { x: car.x + Math.cos(best) * 140, y: sy + (best === 0 ? 12 : -12) };
  } else {
    let ax = city.avenues[0];
    let ad = Infinity;
    for (const a of city.avenues) {
      const dd = Math.abs(a - car.x);
      if (dd < ad) {
        ad = dd;
        ax = a;
      }
    }
    target = { x: ax + (best === -Math.PI / 2 ? 12 : -12), y: car.y + Math.sin(best) * 140 };
  }
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  return { throttle: 1, steer: clamp(wrapAngle(want - car.angle) * 2.5, -1, 1), brake: false };
}

function putPlayerInCar(game, x, y, angle) {
  const car = createCar(x, y, angle, 'sedan');
  car.driver = 'player';
  game.cars.push(car);
  game.player.inCar = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  return car;
}

function simulate(game, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (drive && game.player.inCar) {
      stepCar(game.player.inCar, autopilotInput(game, game.player.inCar), STEP, game.city);
      game.player.x = game.player.inCar.x;
      game.player.y = game.player.inCar.y;
      game.player.angle = game.player.inCar.angle;
    }
    game.traffic.update(STEP, game);
    game.police.update(game, STEP);
    game.time += STEP;
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
  }
}

export function stageShot(name, game) {
  game.time = 0;
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  if (name === 'play') {
    game.screen = 'play';
    startMission(game, 0);
    const spot = game.city.nearestRoadPoint(1050, 1650);
    putPlayerInCar(game, spot.x, spot.y, -Math.PI / 2);
    simulate(game, 2.5, true);
    return;
  }
  if (name === 'chase') {
    game.screen = 'play';
    startMission(game, 1);
    const spot = game.city.nearestRoadPoint(1650, 1650);
    const car = putPlayerInCar(game, spot.x, spot.y, -Math.PI / 2);
    game.wanted.heat = 3;
    // Three cruisers close behind, on the same avenue, so the chase reads.
    for (let i = 0; i < 3; i += 1) {
      const pc = createCar(spot.x + [-20, 0, 20][i], spot.y + 130 + i * 80, -Math.PI / 2, 'police');
      pc.driver = 'police';
      pc.speed = 300;
      game.policeCars.push(pc);
    }
    void car;
    simulate(game, 2, true);
    return;
  }
  if (name === 'mission') {
    game.screen = 'play';
    startMission(game, 1);
    game.mission.stepIndex = 1; // already carrying the package, heading for the pier
    const spot = game.city.nearestRoadPoint(1650, 1950);
    putPlayerInCar(game, spot.x, spot.y, Math.PI / 2);
    simulate(game, 1.2, true);
    return;
  }
  // Default: the title over a living city.
  game.screen = 'title';
  game.camera.x = 1350;
  game.camera.y = 1050;
  simulate(game, 5, false);
}
