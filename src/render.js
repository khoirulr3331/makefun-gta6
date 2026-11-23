// Everything on screen: the city, the cars, the people, the HUD, the minimap
// and the menu screens. Daylight only, so the opening frame always reads.
import { BEACH_Y, PALETTE, ROAD_HALF, WATER_Y, WORLD_H, WORLD_W } from './config.js';
import { currentObjective, missionTarget } from './missions.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (car.exploded) {
    ctx.fillStyle = '#1c1c20';
    roundRect(ctx, -17, -9, 34, 18, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,60,66,0.9)';
    roundRect(ctx, -8, -6, 16, 12, 3);
    ctx.fill();
    ctx.restore();
    return;
  }
  const body = car.kind === 'police' ? '#e8e8e8' : car.color;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -15, -7, 34, 18, 5);
  ctx.fill();
  ctx.fillStyle = body;
  roundRect(ctx, -17, -9, 34, 18, 5);
  ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = PALETTE.police;
    ctx.fillRect(-4, -9, 10, 18);
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-2, -11, 5, 4);
    ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(-2, 7, 5, 4);
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.fillRect(-4, -9, 8, 3);
    ctx.fillRect(-4, 6, 8, 3);
  }
  ctx.fillStyle = '#9fc4d8';
  ctx.fillRect(2, -7, 7, 14);
  ctx.fillStyle = '#222';
  ctx.fillRect(-14, -8, 5, 5);
  ctx.fillRect(-14, 3, 5, 5);
  // Headlights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(15, -7, 2, 4);
  ctx.fillRect(15, 3, 2, 4);
  if (car.target) {
    ctx.rotate(-car.angle);
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + Math.sin(time * 5) * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(car.angle);
  }
  ctx.restore();
  if (car.hp < 55 && !car.exploded) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(car.x - 6, car.y - 6, 6 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWorld(ctx, game) {
  const city = game.city;
  const cam = game.camera;
  const vw = game.viewW;
  const vh = game.viewH;
  const x0 = cam.x - vw / 2 - 60;
  const y0 = cam.y - vh / 2 - 60;
  const x1 = cam.x + vw / 2 + 60;
  const y1 = cam.y + vh / 2 + 60;

  // Ground: grass, then sand and sea along the south edge.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(x0, 0), Math.max(y0, BEACH_Y), Math.min(x1, WORLD_W) - Math.max(x0, 0), Math.min(y1, WORLD_H) - Math.max(y0, BEACH_Y));
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(x0, 0), Math.max(y0, WATER_Y), Math.min(x1, WORLD_W) - Math.max(x0, 0), Math.min(y1, WORLD_H) - Math.max(y0, WATER_Y));
  ctx.fillStyle = PALETTE.waterDeep;
  for (let wx = Math.floor(x0 / 90) * 90; wx < x1; wx += 90) {
    ctx.fillRect(wx, WATER_Y + 40, 46, 3);
    ctx.fillRect(wx + 30, WATER_Y + 90, 40, 3);
  }

  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const ax of city.avenues) ctx.fillRect(ax - ROAD_HALF, 0, ROAD_HALF * 2, BEACH_Y);
  for (const sy of city.streets) ctx.fillRect(0, sy - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const ax of city.avenues) {
    for (let y = 40; y < BEACH_Y; y += 56) ctx.fillRect(ax - 1, y, 2, 26);
  }
  for (const sy of city.streets) {
    for (let x = 40; x < WORLD_W; x += 56) ctx.fillRect(x, sy - 1, 26, 2);
  }
  // Crosswalks at every crossing.
  ctx.fillStyle = 'rgba(240,240,230,0.75)';
  for (const ax of city.avenues) {
    for (const sy of city.streets) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(ax + i * 9 - 3, sy - ROAD_HALF - 4, 6, 8);
        ctx.fillRect(ax + i * 9 - 3, sy + ROAD_HALF - 4, 6, 8);
      }
    }
  }

  // Parks.
  for (const park of city.parks) {
    if (park.x1 < x0 || park.x0 > x1 || park.y1 < y0 || park.y0 > y1) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x0, park.y0, park.x1 - park.x0, park.y1 - park.y0);
    ctx.fillStyle = PALETTE.tree;
    for (const t of park.trees) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Parking lots.
  for (const lot of city.lots) {
    if (lot.x1 < x0 || lot.x0 > x1 || lot.y1 < y0 || lot.y0 > y1) continue;
    ctx.fillStyle = '#55585f';
    ctx.fillRect(lot.x0, lot.y0, lot.x1 - lot.x0, lot.y1 - lot.y0);
    ctx.strokeStyle = 'rgba(230,230,220,0.5)';
    ctx.lineWidth = 1;
    for (const s of lot.spots) {
      ctx.strokeRect(s.x - 18, s.y - 10, 36, 20);
    }
  }
  // The pier deck.
  ctx.fillStyle = '#a9805e';
  ctx.fillRect(city.pier.x - city.pier.w / 2, city.pier.y0, city.pier.w, city.pier.y1 - city.pier.y0);
  ctx.fillStyle = '#8a6a4c';
  for (let y = city.pier.y0 + 12; y < city.pier.y1; y += 22) {
    ctx.fillRect(city.pier.x - city.pier.w / 2, y, city.pier.w, 2);
  }

  // Buildings.
  for (const b of city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(b.x, b.y, b.w, 6);
    ctx.fillRect(b.x, b.y, 6, b.h);
    if (b.w > 60 && b.h > 50) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 22) {
        for (let wy = b.y + 14; wy < b.y + b.h - 12; wy += 24) {
          ctx.fillRect(wx, wy, 10, 8);
        }
      }
    }
    if (b.label) {
      ctx.fillStyle = 'rgba(20,20,26,0.85)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.cx, b.cy + 4);
      ctx.textAlign = 'left';
    }
  }
}

function drawMinimap(ctx, game) {
  const vw = game.viewW;
  const boxW = 208;
  const boxH = 160;
  const bx = vw - boxW - 16;
  const by = 12;
  const scale = Math.min((boxW - 8) / WORLD_W, (boxH - 8) / WORLD_H);
  const mw = WORLD_W * scale;
  const mh = WORLD_H * scale;
  const ox = bx + (boxW - mw) / 2;
  const oy = by + (boxH - mh) / 2;
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, bx, by, boxW, boxH, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, ox, oy, mw, mh, 4);
  ctx.clip();
  ctx.fillStyle = '#5d8a48';
  ctx.fillRect(ox, oy, mw, mh);
  ctx.fillStyle = '#e3cd96';
  ctx.fillRect(ox, oy + BEACH_Y * scale, mw, mh - BEACH_Y * scale);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(ox, oy + WATER_Y * scale, mw, mh - WATER_Y * scale);
  ctx.strokeStyle = '#c9c9c9';
  ctx.lineWidth = 1;
  for (const ax of game.city.avenues) {
    ctx.beginPath();
    ctx.moveTo(ox + ax * scale, oy);
    ctx.lineTo(ox + ax * scale, oy + BEACH_Y * scale);
    ctx.stroke();
  }
  for (const sy of game.city.streets) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + sy * scale);
    ctx.lineTo(ox + mw, oy + sy * scale);
    ctx.stroke();
  }
  const dot = (x, y, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ox + x * scale, oy + y * scale, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const target = missionTarget(game);
  if (target) dot(target.x, target.y, 4, PALETTE.marker);
  for (const pc of game.policeCars) dot(pc.x, pc.y, 2.5, '#5aa2ff');
  dot(game.player.x, game.player.y, 3.5, '#ffffff');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ox + game.player.x * scale, oy + game.player.y * scale, 5.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, game) {
  const p = game.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Cash, health, armour, weapon — top left.
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, 12, 12, 210, 86, 8);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(`$${Math.round(p.cash).toLocaleString('en-US')}`, 24, 42);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('HEALTH', 24, 62);
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(80, 53, 118, 9);
  ctx.fillStyle = p.health > 30 ? '#e5484d' : '#ff8a00';
  ctx.fillRect(80, 53, 118 * Math.max(0, p.health / 100), 9);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.fillText('ARMOUR', 24, 80);
  ctx.fillStyle = '#3a3f47';
  ctx.fillRect(80, 71, 118, 9);
  ctx.fillStyle = '#5aa2ff';
  ctx.fillRect(80, 71, 118 * Math.max(0, p.armour / 100), 9);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 13px system-ui, sans-serif';
  const weaponText = p.weapon === 'pistol' ? `Pistol  ${p.mag} / ${p.reserve}` : 'Fists';
  ctx.fillText(weaponText, 24, 94 - 0);
  // Wanted stars — top centre.
  const stars = game.wanted.stars;
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  let starText = '';
  for (let i = 0; i < 5; i += 1) starText += i < stars ? '★' : '☆';
  ctx.fillStyle = 'rgba(10,14,22,0.72)';
  const sw = ctx.measureText(starText).width;
  roundRect(ctx, game.viewW / 2 - sw / 2 - 12, 12, sw + 24, 38, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.star;
  ctx.fillText(starText, game.viewW / 2, 42);
  ctx.textAlign = 'left';
  // Minimap — top right.
  drawMinimap(ctx, game);
  // Mission box — bottom left.
  const obj = currentObjective(game);
  ctx.font = 'bold 14px system-ui, sans-serif';
  const titleW = ctx.measureText(`MARA — ${obj.title}`).width;
  ctx.font = '13px system-ui, sans-serif';
  const lines = wrapText(ctx, obj.text, 330);
  const boxH = 34 + lines.length * 18 + 10;
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, 12, game.viewH - boxH - 12, Math.max(360, titleW + 40), boxH, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.marker;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(`MARA — ${obj.title}`, 24, game.viewH - boxH + 8);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '13px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, 24, game.viewH - boxH + 30 + i * 18);
  });
  // Controls hint — bottom right, on a dark pill so it reads over any ground.
  const hint = 'WASD move · E car · F punch · 1/2 weapon · P pause · M mute';
  ctx.font = '12px system-ui, sans-serif';
  const hintW = ctx.measureText(hint).width;
  ctx.fillStyle = PALETTE.hudBg;
  roundRect(ctx, game.viewW - hintW - 32, game.viewH - 34, hintW + 20, 22, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'right';
  ctx.fillText(hint, game.viewW - 22, game.viewH - 19);
  ctx.textAlign = 'left';
  // Flash messages (mission payouts).
  if (game.flash && game.flash.t > 0) {
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7ee787';
    ctx.fillText(game.flash.text, game.viewW / 2, 92);
    ctx.textAlign = 'left';
  }
}

function drawMarker(ctx, game) {
  const target = missionTarget(game);
  if (!target) return;
  const cam = game.camera;
  const sx = target.x - (cam.x - game.viewW / 2);
  const sy = target.y - (cam.y - game.viewH / 2);
  const pulse = 1 + Math.sin(game.time * 5) * 0.15;
  if (sx > 40 && sx < game.viewW - 40 && sy > 40 && sy < game.viewH - 40) {
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, 30 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 44);
    ctx.lineTo(sx - 8, sy - 30);
    ctx.lineTo(sx + 8, sy - 30);
    ctx.closePath();
    ctx.fill();
    return;
  }
  // Off-screen: an arrow on the screen edge pointing at the target.
  const cx = game.viewW / 2;
  const cy = game.viewH / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(ang) * (game.viewW / 2 - 60);
  const ey = cy + Math.sin(ang) * (game.viewH / 2 - 60);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function dimScreen(ctx, game, alpha) {
  ctx.fillStyle = `rgba(8, 10, 18, ${alpha})`;
  ctx.fillRect(0, 0, game.viewW, game.viewH);
}

function bigText(ctx, game, title, sub, color) {
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, game.viewW / 2, game.viewH / 2 - 30);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '18px system-ui, sans-serif';
  const lines = wrapText(ctx, sub, 640);
  lines.forEach((line, i) => {
    ctx.fillText(line, game.viewW / 2, game.viewH / 2 + 12 + i * 26);
  });
  ctx.textAlign = 'left';
}

export function render(game) {
  const ctx = game.ctx;
  const vw = game.viewW;
  const vh = game.viewH;
  ctx.clearRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(vw / 2 - game.camera.x, vh / 2 - game.camera.y);
  drawWorld(ctx, game);
  // Mission marker ring on the ground.
  const target = missionTarget(game);
  if (target && game.screen === 'play') {
    ctx.strokeStyle = 'rgba(255, 211, 77, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 26 + Math.sin(game.time * 4) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const car of game.cars) {
    if (car.driver === 'player') continue;
    drawCar(ctx, car, game.time);
  }
  for (const pc of game.policeCars) drawCar(ctx, pc, game.time);
  if (game.player.inCar) drawCar(ctx, game.player.inCar, game.time);
  for (const ped of game.peds) {
    if (!ped.alive) {
      if (ped.fade > 3.5) continue;
      ctx.globalAlpha = Math.max(0, 1 - ped.fade / 3.5);
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of game.cops) {
    if (!cop.alive) continue;
    ctx.fillStyle = '#2b3a55';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8d8d8';
    ctx.beginPath();
    ctx.arc(cop.x, cop.y - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!game.player.inCar) {
    const p = game.player;
    ctx.fillStyle = '#2fd67b';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f7a44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#0f7a44';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 16, p.y + Math.sin(p.angle) * 16);
    ctx.stroke();
    if (p.punchAnim > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, p.angle - 0.7, p.angle + 0.7);
      ctx.stroke();
    }
  }
  for (const t of game.tracers) {
    ctx.strokeStyle = `rgba(255, 240, 160, ${Math.max(0, t.life / 0.6)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  ctx.restore();

  if (game.screen === 'play' || game.screen === 'pause') {
    drawMarker(ctx, game);
    drawHud(ctx, game);
  }
  if (game.screen === 'title') {
    dimScreen(ctx, game, 0.45);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText('PALMERA BAY', vw / 2, 190);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('A sun-soaked open-city crime story', vw / 2, 228);
    ctx.font = '16px system-ui, sans-serif';
    const lines = [
      'WASD / arrows — walk and drive · Shift — run · E — steal / exit car',
      'Mouse — aim and shoot · F — punch · 1 / 2 — fists / pistol · R — reload',
      'P — pause · M — mute · Steal cars, lose the cops, run six jobs for Mara.',
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, vw / 2, 300 + i * 28);
    });
    ctx.fillStyle = game.saveExists ? '#7ee787' : '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(game.saveExists ? 'PRESS ENTER — CONTINUE' : 'PRESS ENTER TO PLAY', vw / 2, 430);
    if (game.saveExists) {
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText('N — start a new game instead', vw / 2, 462);
    }
    ctx.fillStyle = 'rgba(242,237,226,0.6)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('An original work of fiction. Not affiliated with Rockstar Games.', vw / 2, vh - 24);
    ctx.textAlign = 'left';
  }
  if (game.screen === 'pause') {
    dimScreen(ctx, game, 0.55);
    bigText(ctx, game, 'PAUSED', 'Press P to keep playing. Your progress is saved.', '#f2ede2');
  }
  if (game.screen === 'busted') {
    dimScreen(ctx, game, 0.6);
    bigText(ctx, game, 'BUSTED', 'The Palmera Bay PD caught you. Bail is $100 — press Enter to walk free.', '#5aa2ff');
  }
  if (game.screen === 'wasted') {
    dimScreen(ctx, game, 0.6);
    bigText(ctx, game, 'WASTED', 'You wake up at the hospital, lighter by 10% of your cash. Press Enter.', '#e5484d');
  }
  if (game.screen === 'complete') {
    dimScreen(ctx, game, 0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('STORY COMPLETE', vw / 2, vh / 2 - 60);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(`All six jobs for Mara are done. You earned $${game.stats.earned.toLocaleString('en-US')} across the story.`, vw / 2, vh / 2 - 10);
    ctx.fillText('Free roam continues — press Enter to keep driving Palmera Bay.', vw / 2, vh / 2 + 24);
    ctx.textAlign = 'left';
  }
}
