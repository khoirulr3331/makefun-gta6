// Six jobs for Mara, the fixer. One active at a time, each a short chain of
// steps; every target sits on a road or sidewalk, never inside a building.
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    briefing: 'Mara needs a car, any car. Take one and bring it to the garage.',
    payout: 500,
    steps: [
      { type: 'steal', text: 'Steal any car (walk up to one, press E)' },
      { type: 'goto', place: 'garage', radius: 90, text: 'Bring the car to Mara\'s Garage' },
    ],
  },
  {
    id: 'the-drop',
    title: 'The Drop',
    briefing: 'A package at the diner, a buyer waiting at the pier. No questions.',
    payout: 800,
    steps: [
      { type: 'pickup', place: 'diner', radius: 90, text: 'Pick up the package at the Diner' },
      { type: 'goto', place: 'pier', radius: 90, text: 'Deliver it to the Pier' },
    ],
  },
  {
    id: 'bank-run',
    title: 'Bank Run',
    briefing: 'Hold the bank doors while the crew works inside. The cops will come.',
    payout: 1500,
    steps: [
      { type: 'goto', place: 'bank', radius: 90, text: 'Get to the Bank' },
      { type: 'holdout', place: 'bank', radius: 110, seconds: 30, text: 'Hold out at the Bank — 30 seconds' },
    ],
  },
  {
    id: 'getaway',
    title: 'Getaway',
    briefing: 'Three stars and every cruiser in the city on you. Lose them all.',
    payout: 1200,
    steps: [
      { type: 'escape', text: 'Lose the cops — get your wanted level to zero' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    briefing: 'A blue sports car, parked near the mall. Mara wants that one, and only that one.',
    payout: 2000,
    steps: [
      { type: 'stealSports', place: 'mall', radius: 90, text: 'Steal the blue sports car by the Mall' },
      { type: 'goto', place: 'garage', radius: 90, text: 'Bring it to Mara\'s Garage' },
    ],
  },
  {
    id: 'the-big-one',
    title: 'The Big One',
    briefing: 'The last job. Mall, hotel, cops, garage — do it clean and we are done.',
    payout: 5000,
    steps: [
      { type: 'pickup', place: 'mall', radius: 90, text: 'Pick up the case at the Mall' },
      { type: 'goto', place: 'hotel', radius: 90, text: 'Drop it at the Hotel' },
      { type: 'holdout', place: 'hotel', radius: 110, seconds: 20, text: 'Hold the Hotel lobby — 20 seconds' },
      { type: 'escape', text: 'Lose the cops — get your wanted level to zero' },
      { type: 'goto', place: 'garage', radius: 90, text: 'Get back to Mara\'s Garage' },
    ],
  },
];

export function createMissionState() {
  return { index: 0, def: MISSIONS[0], stepIndex: 0, stepT: 0, done: false, targetCar: null };
}

export function missionTarget(game) {
  const m = game.mission;
  if (!m || m.done) return null;
  const step = m.def.steps[m.stepIndex];
  if (!step) return null;
  if (step.type === 'stealSports' && m.targetCar) return { x: m.targetCar.x, y: m.targetCar.y, label: 'Sports car' };
  if (step.place) {
    const lm = game.city.landmarks[step.place];
    if (lm) return { x: lm.door.x, y: lm.door.y, label: lm.label };
  }
  return null;
}

export function currentObjective(game) {
  const m = game.mission;
  if (!m) return { title: 'Palmera Bay', text: 'Press Enter to start.' };
  if (m.done) return { title: m.def.title, text: 'Job done — nice work.' };
  const step = m.def.steps[m.stepIndex];
  let text = step ? step.text : '';
  if (step && step.type === 'holdout') {
    const left = Math.max(0, Math.ceil(step.seconds - m.stepT));
    text = `${step.text.split(' — ')[0]} — ${left}s left`;
  }
  return { title: `${m.def.title} (${m.index + 1}/6)`, text };
}

// Called when the player does something a step may be waiting for.
export function missionEvent(game, event) {
  const m = game.mission;
  if (!m || m.done) return;
  const step = m.def.steps[m.stepIndex];
  if (!step) return;
  if (event === 'stoleTarget' && step.type === 'stealSports') {
    advanceStep(game);
  }
}

function advanceStep(game) {
  const m = game.mission;
  m.stepIndex += 1;
  m.stepT = 0;
  game.audio.pickup();
  if (m.stepIndex >= m.def.steps.length) {
    completeMission(game);
  } else {
    enterStep(game);
  }
}

function enterStep(game) {
  const m = game.mission;
  const step = m.def.steps[m.stepIndex];
  if (!step) return;
  if (step.type === 'escape') {
    game.wanted.heat = 3;
    game.wanted.quietT = 0;
  }
  if (step.type === 'holdout' && (m.def.id === 'bank-run')) {
    game.wanted.heat = Math.max(game.wanted.heat, 2);
  }
  if (step.type === 'stealSports') {
    spawnTargetCar(game);
  }
}

function spawnTargetCar(game) {
  const mall = game.city.landmarks.mall;
  const spot = game.city.nearestRoadPoint(mall.door.x, mall.door.y + 40);
  const car = {
    x: spot.x,
    y: spot.y,
    angle: spot.angle,
    speed: 0,
    kind: 'sports',
    color: '#3fa7d6',
    top: 520,
    accel: 380,
    hp: 100,
    exploded: false,
    driver: null,
    parked: true,
    dir: 0,
    line: 0,
    nextCross: 0,
    cruise: 150,
    target: true,
    smoke: 0,
  };
  game.cars.push(car);
  game.mission.targetCar = car;
}

function completeMission(game) {
  const m = game.mission;
  m.done = true;
  game.player.cash += m.def.payout;
  game.stats.earned += m.def.payout;
  game.audio.missionDone();
  game.flash = { text: `Job done — $${m.def.payout}`, t: 3 };
  game.save();
  if (m.index + 1 >= MISSIONS.length) {
    game.screen = 'complete';
    return;
  }
  // Next job starts right away.
  game.mission = { index: m.index + 1, def: MISSIONS[m.index + 1], stepIndex: 0, stepT: 0, done: false, targetCar: null };
  enterStep(game);
}

export function startMission(game, index) {
  game.mission = { index, def: MISSIONS[index], stepIndex: 0, stepT: 0, done: false, targetCar: null };
  enterStep(game);
}

// Per-frame mission progress: reach targets, hold positions, lose the cops.
export function updateMission(game, dt) {
  const m = game.mission;
  if (!m || m.done) return;
  const step = m.def.steps[m.stepIndex];
  if (!step) return;
  const p = game.player;
  const at = (x, y, r) => Math.hypot(p.x - x, p.y - y) < r;
  if (step.type === 'steal') {
    if (p.inCar) advanceStep(game);
  } else if (step.type === 'goto' || step.type === 'pickup') {
    const lm = game.city.landmarks[step.place];
    if (lm && at(lm.door.x, lm.door.y, step.radius)) advanceStep(game);
  } else if (step.type === 'holdout') {
    const lm = game.city.landmarks[step.place];
    if (lm && at(lm.door.x, lm.door.y, step.radius)) {
      m.stepT += dt;
      if (m.stepT >= step.seconds) advanceStep(game);
    }
  } else if (step.type === 'escape') {
    if (game.wanted.stars === 0) advanceStep(game);
  } else if (step.type === 'stealSports') {
    if (p.inCar && p.inCar.target) advanceStep(game);
  }
}
