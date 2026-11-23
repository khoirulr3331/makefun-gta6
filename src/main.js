// Palmera Bay: a 2D top-down open-city crime game. Wires every system
// together, runs the loop, and exposes the debug handle the tests read.
import { SEED, WORLD_H, WORLD_W } from './config.js';
import { createCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPolice, createWanted, updateWanted } from './police.js';
import { createMissionState, startMission, updateMission } from './missions.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { loadSave, writeSave, clearSave } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '', 10) || SEED;

const city = createCity(seed);
const traffic = createTraffic(city, seed);
const police = createPolice(city, seed);
const player = createPlayer(city);
const audio = createAudio();
const input = createInput(canvas);

const game = {
  screen: 'title',
  time: 0,
  city,
  player,
  cars: traffic.cars,
  peds: traffic.peds,
  cops: police.cops,
  policeCars: police.cars,
  wanted: createWanted(),
  mission: null,
  tracers: [],
  camera: { x: player.x, y: player.y },
  viewW: canvas.width,
  viewH: canvas.height,
  ctx,
  input,
  audio,
  traffic,
  police,
  stats: { shots: 0, earned: 0 },
  flash: null,
  saveExists: false,
  shotMode: shotName,
  save() {
    writeSave(game);
  },
  busted() {
    if (game.screen !== 'play') return;
    game.screen = 'busted';
    game.player.cash = Math.max(0, game.player.cash - 100);
    game.audio.busted();
    game.audio.stopSiren();
    game.save();
  },
  wasted() {
    if (game.screen !== 'play') return;
    game.screen = 'wasted';
    game.player.cash = Math.round(game.player.cash * 0.9);
    game.audio.busted();
    game.audio.stopSiren();
    game.save();
  },
};

window.__palmera = game;
window.__shotReady = false;

function respawn(atHospital) {
  const door = atHospital ? city.landmarks.hospital.door : city.landmarks.garage.door;
  player.x = door.x;
  player.y = door.y + 30;
  player.angle = -Math.PI / 2;
  player.health = 100;
  player.armour = 0;
  player.inCar = null;
  game.wanted.heat = 0;
  game.wanted.stars = 0;
  game.wanted.quietT = 0;
  game.camera.x = player.x;
  game.camera.y = player.y;
  game.screen = 'play';
}

function startGame(fresh) {
  if (fresh) {
    clearSave();
    player.cash = 250;
    player.health = 100;
    game.stats.earned = 0;
  } else if (game.saveExists) {
    const data = loadSave();
    if (data) {
      player.cash = data.cash || 250;
      game.stats.earned = data.earned || 0;
      startMission(game, Math.min(data.missionIndex || 0, 5));
      game.screen = 'play';
      return;
    }
  }
  startMission(game, 0);
  game.screen = 'play';
}

function update(dt) {
  game.viewW = canvas.width;
  game.viewH = canvas.height;
  if (input.wasPressed('KeyM')) {
    const muted = audio.toggleMute();
    game.flash = { text: muted ? 'Sound off' : 'Sound on', t: 1.2 };
  }
  if (game.screen === 'title') {
    traffic.update(dt, game);
    game.camera.x = 1350 + Math.sin(game.time * 0.05) * 120;
    game.camera.y = 1050 + Math.cos(game.time * 0.04) * 80;
    game.time += dt;
    if (input.wasPressed('Enter')) {
      audio.unlock();
      startGame(false);
    } else if (input.wasPressed('KeyN') && game.saveExists) {
      audio.unlock();
      startGame(true);
    }
    return;
  }
  if (game.screen === 'pause') {
    if (input.wasPressed('KeyP')) game.screen = 'play';
    return;
  }
  if (game.screen === 'busted') {
    if (input.wasPressed('Enter')) respawn(false);
    return;
  }
  if (game.screen === 'wasted') {
    if (input.wasPressed('Enter')) respawn(true);
    return;
  }
  if (game.screen === 'complete') {
    traffic.update(dt, game);
    police.update(game, dt);
    updatePlayer(game, dt);
    game.time += dt;
    if (input.wasPressed('Enter')) game.screen = 'play';
    return;
  }
  // Screen: play.
  if (input.wasPressed('KeyP')) {
    game.screen = 'pause';
    game.save();
    audio.engineOff();
    return;
  }
  game.time += dt;
  updateWanted(game, dt);
  updatePlayer(game, dt);
  traffic.update(dt, game);
  police.update(game, dt);
  updateMission(game, dt);
  for (let i = game.tracers.length - 1; i >= 0; i -= 1) {
    game.tracers[i].life -= dt;
    if (game.tracers[i].life <= 0) game.tracers.splice(i, 1);
  }
  if (game.flash) {
    game.flash.t -= dt;
    if (game.flash.t <= 0) game.flash = null;
  }
  // Slow health recovery while out of trouble.
  if (player.health < 100 && player.health > 0) {
    player.health = Math.min(100, player.health + 1.5 * dt);
  }
  if (player.health <= 0) {
    game.wasted();
    return;
  }
  // Camera follows the player, clamped inside the world.
  const hw = game.viewW / 2;
  const hh = game.viewH / 2;
  game.camera.x = Math.max(hw, Math.min(WORLD_W - hw, player.x));
  game.camera.y = Math.max(hh, Math.min(WORLD_H - hh, player.y));
  game.saveT = (game.saveT || 0) + dt;
  if (game.saveT > 15) {
    game.saveT = 0;
    game.save();
  }
}

// Boot: fresh world, then a screenshot scene when ?shot= is given.
const saved = loadSave();
game.saveExists = !!saved;
if (saved && saved.muted) audio.toggleMute();
traffic.seedInitial(null);
if (shotName) {
  game.mission = createMissionState();
  stageShot(shotName, game);
  game.saveExists = false;
}

let last = performance.now();
let shotReadySet = false;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  update(dt);
  render(game);
  input.endFrame();
  if (game.shotMode && !shotReadySet) {
    shotReadySet = true;
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
