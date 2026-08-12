import { W, H, GROUND } from './data';
import { drawScene, drawFighter, drawShadow, makeSnow, updateSnow, drawSnow, Flake } from './draw';
import { Game } from './engine';

let snow: Flake[] | null = null;
const COARSE = typeof window !== 'undefined' &&
  ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window);

function skewBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, skew: number, flip: boolean) {
  ctx.beginPath();
  if (!flip) {
    ctx.moveTo(x + skew, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - skew, y + h);
    ctx.lineTo(x, y + h);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - skew, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + skew, y + h);
  }
  ctx.closePath();
}

function healthBar(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  ratio: number, ghost: number, right: boolean, name: string, meter: number,
) {
  const skew = 14;
  ctx.save();
  // frame
  skewBar(ctx, x - 4, y - 4, w + 8, h + 8, skew, right);
  ctx.fillStyle = 'rgba(8,10,14,0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(242,181,68,0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ghost (damage trail)
  const gw = Math.max(0, w * ghost);
  ctx.save();
  skewBar(ctx, x, y, w, h, skew, right);
  ctx.clip();
  ctx.fillStyle = '#2a1116';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,240,160,0.55)';
  if (right) ctx.fillRect(x, y, gw, h);
  else ctx.fillRect(x + w - gw, y, gw, h);

  const hw = Math.max(0, w * ratio);
  const grd = ctx.createLinearGradient(x, y, x, y + h);
  const low = ratio < 0.28;
  grd.addColorStop(0, low ? '#ff8a5c' : '#7be07b');
  grd.addColorStop(0.5, low ? '#e03a24' : '#3fae4a');
  grd.addColorStop(1, low ? '#8c1408' : '#1f6b2c');
  ctx.fillStyle = grd;
  if (right) ctx.fillRect(x, y, hw, h);
  else ctx.fillRect(x + w - hw, y, hw, h);
  // gloss
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x, y, w, h * 0.35);
  ctx.restore();

  // name
  ctx.font = '700 19px Oswald, sans-serif';
  ctx.fillStyle = '#f4e7cf';
  ctx.textAlign = right ? 'left' : 'right';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 6;
  ctx.fillText(name, right ? x + 6 : x + w - 6, y + h + 24);
  ctx.shadowBlur = 0;

  // meter
  const my = y + h + 30;
  ctx.fillStyle = 'rgba(8,10,14,0.8)';
  ctx.fillRect(right ? x : x + w - w * 0.55, my, w * 0.55, 8);
  const mg = ctx.createLinearGradient(x, my, x + w, my);
  mg.addColorStop(0, '#ffcf5c');
  mg.addColorStop(1, '#ff5c2b');
  ctx.fillStyle = meter >= 100 ? '#fff0a8' : mg;
  const mw = w * 0.55 * (meter / 100);
  if (right) ctx.fillRect(x, my, mw, 8);
  else ctx.fillRect(x + w - mw, my, mw, 8);
  ctx.strokeStyle = 'rgba(242,181,68,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(right ? x : x + w - w * 0.55, my, w * 0.55, 8);
  ctx.restore();
}

let ghostP = 1, ghostE = 1;

export function renderGame(ctx: CanvasRenderingContext2D, g: Game, t: number, dt: number) {
  if (!snow) snow = makeSnow(90);
  updateSnow(snow, dt, t, g.shakeX * 2);

  ctx.save();
  // camera
  const z = g.camZoom;
  ctx.translate(g.shakeX, g.shakeY);
  ctx.scale(z, z);
  ctx.translate(-(g.camX - W / (2 * z)), -(H - H / z));

  drawScene(ctx, t);

  // shadows + fighters
  drawShadow(ctx, g.p.render());
  drawShadow(ctx, g.e.render());

  // particles behind
  drawParticles(ctx, g, false);

  const order = g.p.y <= g.e.y ? [g.e, g.p] : [g.p, g.e];
  for (const f of order) drawFighter(ctx, f.render(), t);

  // projectiles
  for (const pr of g.projectiles) {
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.rotate(pr.rot);
    ctx.fillStyle = 'rgba(120,220,160,0.95)';
    ctx.fillRect(-6, -14, 12, 26);
    ctx.fillStyle = 'rgba(170,255,200,0.95)';
    ctx.fillRect(-3, -22, 6, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-5, -12, 3, 20);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#9dfcc4';
    ctx.beginPath();
    ctx.ellipse(pr.x - Math.sign(pr.vx) * 22, pr.y, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawParticles(ctx, g, true);
  drawSnow(ctx, snow);

  // floating texts (world space)
  for (const tx of g.texts) {
    const a = Math.min(1, tx.life / tx.max * 1.6);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `700 ${tx.size}px "Russo One", Oswald, sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(tx.text, tx.x, tx.y);
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.text, tx.x, tx.y);
    ctx.restore();
  }

  ctx.restore();

  // vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.86);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // low-health red pulse
  const hpr = g.p.hp / g.p.maxHp;
  if (hpr < 0.25 && g.phase === 'fight') {
    ctx.fillStyle = `rgba(180,20,20,${0.1 + Math.sin(t * 6) * 0.06})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (g.flashWhite > 0) {
    ctx.fillStyle = `rgba(255,240,220,${Math.min(0.75, g.flashWhite)})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawHud(ctx, g, t);
}

function drawParticles(ctx: CanvasRenderingContext2D, g: Game, front: boolean) {
  for (const p of g.particles) {
    const isFront = p.kind !== 'smoke';
    if (isFront !== front) continue;
    const a = Math.min(1, p.life / p.max * 1.8);
    ctx.globalAlpha = a;
    if (p.kind === 'ring') {
      const k = 1 - p.life / p.max;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.globalAlpha = a * 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size + k * 46, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'shard') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
      ctx.restore();
    } else if (p.kind === 'spark') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game, t: number) {
  const pr = g.p.hp / g.p.maxHp;
  const er = g.e.hp / g.e.maxHp;
  ghostP += (pr - ghostP) * 0.06;
  ghostE += (er - ghostE) * 0.06;
  if (ghostP < pr) ghostP = pr;
  if (ghostE < er) ghostE = er;

  healthBar(ctx, 34, 26, 356, 24, pr, ghostP, true, g.p.def.name, g.p.meter);
  healthBar(ctx, W - 34 - 356, 26, 356, 24, er, ghostE, false, g.e.def.name, g.e.meter);

  // timer
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '700 46px "Russo One", Oswald, sans-serif';
  const low = g.timer <= 10 && g.phase === 'fight';
  ctx.fillStyle = low ? `rgba(255,${80 + Math.sin(t * 12) * 60},60,1)` : '#f6e8cd';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 5;
  const tt = String(Math.max(0, Math.ceil(g.timer))).padStart(2, '0');
  ctx.strokeText(tt, W / 2, 62);
  ctx.fillText(tt, W / 2, 62);

  ctx.font = '600 15px Oswald, sans-serif';
  ctx.fillStyle = 'rgba(242,181,68,0.9)';
  ctx.fillText(`БОЙ ${g.stage + 1}`, W / 2, 82);

  // score
  ctx.textAlign = 'center';
  ctx.font = '700 22px "Russo One", Oswald, sans-serif';
  ctx.fillStyle = '#ffe6a8';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 4;
  const sc = `ОЧКИ ${Math.round(g.score).toLocaleString('ru-RU')}`;
  ctx.strokeText(sc, W / 2, 112);
  ctx.fillText(sc, W / 2, 112);

  // combo counter
  if (g.p.comboHits >= 2 && g.p.comboT > 0) {
    ctx.textAlign = 'left';
    const k = Math.min(1, g.p.comboT * 3);
    ctx.globalAlpha = k;
    ctx.font = `700 ${30 + g.p.comboHits * 3}px "Russo One", Oswald, sans-serif`;
    ctx.fillStyle = '#ffd24a';
    ctx.strokeText(`${g.p.comboHits} УДАРОВ`, 40, 150);
    ctx.fillText(`${g.p.comboHits} УДАРОВ`, 40, 150);
    ctx.globalAlpha = 1;
  }

  // super ready hint
  if (g.p.meter >= 100 && g.phase === 'fight') {
    ctx.textAlign = 'left';
    ctx.font = '700 17px Oswald, sans-serif';
    ctx.fillStyle = `rgba(255,220,120,${0.6 + Math.sin(t * 8) * 0.35})`;
    ctx.fillText('СУПЕР ГОТОВ — [U] / СПЕЦ', 36, 96);
  }

  // banner
  if (g.bannerT > 0) {
    const k = Math.min(1, (2.6 - g.bannerT) * 6);
    const pop = 1 + Math.max(0, 0.35 - (1 - Math.min(1, g.bannerT * 3)) * 0.35);
    ctx.save();
    ctx.translate(W / 2, H * 0.42);
    ctx.scale(pop * (0.8 + k * 0.2), pop * (0.8 + k * 0.2));
    ctx.textAlign = 'center';
    ctx.font = '700 74px "Russo One", Impact, sans-serif';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(g.banner, 0, 0);
    const grd = ctx.createLinearGradient(0, -50, 0, 30);
    grd.addColorStop(0, '#fff3c4');
    grd.addColorStop(0.5, '#ffb63c');
    grd.addColorStop(1, '#d13a2a');
    ctx.fillStyle = grd;
    ctx.shadowColor = 'rgba(255,80,40,0.9)';
    ctx.shadowBlur = 26;
    ctx.fillText(g.banner, 0, 0);
    ctx.restore();
  }

  // first-fight control hints
  if (g.stage === 0 && g.phase === 'fight' && g.phaseT < 7) {
    const a = Math.min(1, 7 - g.phaseT) * 0.85;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '600 16px Oswald, sans-serif';
    ctx.fillStyle = '#dfe7f2';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.fillText(COARSE
      ? 'ДЖОЙСТИК СЛЕВА · УДАР / НОГА СПРАВА · ▼+УДАР = АПЕРКОТ'
      : 'A D — ХОДИТЬ · W — ПРЫЖОК · J — УДАР · K — НОГА · L — БЛОК · S+J — АПЕРКОТ · U — СПЕЦ',
      W / 2, H - 24);
    ctx.restore();
  }

  if (g.phase === 'finisher' && !g.fatalityDone) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 22px Oswald, sans-serif';
    ctx.fillStyle = `rgba(255,90,60,${0.65 + Math.sin(t * 10) * 0.3})`;
    ctx.fillText('ПОДОЙДИ И ЖМИ СПЕЦ-УДАР', W / 2, H * 0.55);
    ctx.restore();
  }
  ctx.restore();
}

export function resetHudSmoothing() {
  ghostP = 1;
  ghostE = 1;
}

export const GROUND_Y = GROUND;
