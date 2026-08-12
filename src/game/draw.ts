import { W, H, GROUND, Palette } from './data';
import arenaYardUrl from '../assets/arena-yard-bg.webp';
import { resolveSprite, enemyHue, preloadSprites } from './sprites';
export { preloadSprites };

/* ---------------------------------- utils --------------------------------- */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function seg(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* -------------------------------- background ------------------------------- */

let bgCache: HTMLCanvasElement | null = null;
const windowSeeds: { x: number; y: number; w: number; h: number; on: number; ph: number }[] = [];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function buildBackground() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const r = rand(1337);

  // sky
  const sky = g.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#0b1220');
  sky.addColorStop(0.45, '#1a2231');
  sky.addColorStop(0.8, '#39364a');
  sky.addColorStop(1, '#5a4a52');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // moon
  g.fillStyle = 'rgba(240,238,220,0.85)';
  g.beginPath();
  g.arc(790, 78, 26, 0, Math.PI * 2);
  g.fill();
  const halo = g.createRadialGradient(790, 78, 10, 790, 78, 120);
  halo.addColorStop(0, 'rgba(230,230,255,0.22)');
  halo.addColorStop(1, 'rgba(230,230,255,0)');
  g.fillStyle = halo;
  g.fillRect(650, -40, 300, 260);

  // far panel houses
  const drawHouse = (x: number, y: number, w: number, h: number, col: string, cols: number, rows: number, lit: number) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x, y, w, 6);
    const pw = w / cols;
    const ph = h / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const wx = x + i * pw + pw * 0.22;
        const wy = y + j * ph + ph * 0.22;
        const ww = pw * 0.54;
        const wh = ph * 0.5;
        const on = r() < lit;
        g.fillStyle = on ? 'rgba(255,204,120,0.85)' : 'rgba(20,26,38,0.9)';
        g.fillRect(wx, wy, ww, wh);
        if (on && r() < 0.5) windowSeeds.push({ x: wx, y: wy, w: ww, h: wh, on: 1, ph: r() * 10 });
      }
    }
  };

  drawHouse(-20, 150, 250, 320, '#232b3a', 6, 9, 0.28);
  drawHouse(240, 190, 190, 280, '#1e2533', 5, 8, 0.22);
  drawHouse(455, 130, 230, 340, '#252d3d', 6, 10, 0.3);
  drawHouse(700, 175, 290, 295, '#1f2734', 7, 8, 0.25);

  // snowy roofs
  g.fillStyle = 'rgba(220,228,240,0.5)';
  [[-20, 150, 250], [240, 190, 190], [455, 130, 230], [700, 175, 290]].forEach(([x, y, w]) => {
    g.fillRect(x, y - 4, w, 6);
  });

  // mid: garages
  g.fillStyle = '#2b2e2b';
  for (let i = 0; i < 8; i++) {
    const x = -30 + i * 130;
    g.fillStyle = i % 2 ? '#38352c' : '#2f3a33';
    g.fillRect(x, 330, 126, 100);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(x + 8, 348, 110, 78);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x + 8, 348, 110, 6);
    g.fillStyle = 'rgba(215,225,235,0.55)';
    g.fillRect(x, 324, 126, 8);
    // rust
    g.fillStyle = 'rgba(150,80,40,0.18)';
    g.fillRect(x + 20 + r() * 60, 360 + r() * 40, 18, 22);
  }

  // graffiti
  g.save();
  g.globalAlpha = 0.5;
  g.font = 'bold 26px Oswald, sans-serif';
  g.fillStyle = '#d13a2a';
  g.fillText('ЦОЙ ЖИВ', 96, 400);
  g.fillStyle = '#6ea3c9';
  g.fillText('СЛАВА', 620, 392);
  g.fillStyle = '#f2b544';
  g.font = 'bold 18px Oswald, sans-serif';
  g.fillText('здесь был витёк', 300, 412);
  g.restore();

  // ground snow
  const gr = g.createLinearGradient(0, GROUND - 20, 0, H);
  gr.addColorStop(0, '#c9d4e0');
  gr.addColorStop(0.25, '#9aa8ba');
  gr.addColorStop(1, '#5a6472');
  g.fillStyle = gr;
  g.fillRect(0, GROUND - 8, W, H - GROUND + 8);
  // dirty patches
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${40 + r() * 40},${40 + r() * 30},${40 + r() * 30},${0.06 + r() * 0.1})`;
    const x = r() * W;
    const y = GROUND + r() * (H - GROUND);
    g.beginPath();
    g.ellipse(x, y, 10 + r() * 50, 3 + r() * 8, 0, 0, Math.PI * 2);
    g.fill();
  }
  // curb line
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, GROUND - 6);
  g.lineTo(W, GROUND - 6);
  g.stroke();

  return c;
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, t: number) {
  const flick = 0.75 + Math.sin(t * 9 + x) * 0.05 + (Math.random() < 0.03 ? -0.3 : 0);
  ctx.fillStyle = '#191d22';
  ctx.fillRect(x - 4, 190, 8, GROUND - 190);
  ctx.fillRect(x - 4, 190, 46, 7);
  ctx.save();
  const gl = ctx.createRadialGradient(x + 42, 200, 4, x + 42, 200, 190);
  gl.addColorStop(0, `rgba(255,214,140,${0.5 * flick})`);
  gl.addColorStop(0.4, `rgba(255,190,110,${0.13 * flick})`);
  gl.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.moveTo(x + 42, 198);
  ctx.lineTo(x + 42 - 150, GROUND + 40);
  ctx.lineTo(x + 42 + 150, GROUND + 40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = `rgba(255,226,160,${flick})`;
  ctx.beginPath();
  ctx.ellipse(x + 42, 202, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBarrelFire(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.fillStyle = '#3a2b22';
  rr(ctx, x - 22, y - 46, 44, 46, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x - 22, y - 34, 44, 4);
  ctx.fillRect(x - 22, y - 18, 44, 4);
  const flames = 5;
  for (let i = 0; i < flames; i++) {
    const p = i / flames;
    const fx = x - 14 + p * 28 + Math.sin(t * 6 + i * 2) * 4;
    const fh = 26 + Math.sin(t * 8 + i * 3.1) * 14 + (1 - Math.abs(p - 0.5) * 2) * 18;
    const grd = ctx.createLinearGradient(fx, y - 46, fx, y - 46 - fh);
    grd.addColorStop(0, 'rgba(255,220,120,0.95)');
    grd.addColorStop(0.5, 'rgba(255,130,40,0.75)');
    grd.addColorStop(1, 'rgba(210,40,20,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(fx - 7, y - 44);
    ctx.quadraticCurveTo(fx - 3, y - 46 - fh * 0.6, fx, y - 46 - fh);
    ctx.quadraticCurveTo(fx + 3, y - 46 - fh * 0.6, fx + 7, y - 44);
    ctx.closePath();
    ctx.fill();
  }
  const glow = ctx.createRadialGradient(x, y - 60, 6, x, y - 60, 150);
  glow.addColorStop(0, 'rgba(255,140,50,0.28)');
  glow.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 150, y - 210, 300, 300);
}

let arenaImg: HTMLImageElement | null = null;
let arenaReady = false;
function ensureArena() {
  if (arenaImg) return;
  arenaImg = new Image();
  arenaImg.onload = () => { arenaReady = true; };
  arenaImg.src = arenaYardUrl;
}

export function drawScene(ctx: CanvasRenderingContext2D, t: number) {
  ensureArena();
  if (!bgCache) bgCache = buildBackground();
  // ONE background only — never stack arena + procedural
  if (arenaReady && arenaImg) {
    const iw = arenaImg.width || 1, ih = arenaImg.height || 1;
    const scale = Math.max(W / iw, H / ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(arenaImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    // light vignette only (no second scene)
    ctx.fillStyle = 'rgba(6,10,16,0.18)';
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.drawImage(bgCache, 0, 0);
    // procedural extras only when no photo arena
    ctx.save();
    for (let i = 0; i < windowSeeds.length; i++) {
      const s = windowSeeds[i];
      const a = 0.5 + Math.sin(t * 1.5 + s.ph) * 0.35;
      ctx.fillStyle = `rgba(255,196,110,${clamp(a, 0, 1) * 0.5})`;
      ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    ctx.restore();
    drawLamp(ctx, 120, t);
    drawLamp(ctx, 830, t);
    drawBarrelFire(ctx, 60, GROUND + 26, t);
    drawBarrelFire(ctx, 905, GROUND + 26, t);
  }
}

/* ---------------------------------- snow ---------------------------------- */

export type Flake = { x: number; y: number; vx: number; vy: number; r: number; a: number };
export function makeSnow(n: number): Flake[] {
  const f: Flake[] = [];
  for (let i = 0; i < n; i++) {
    f.push({
      x: Math.random() * W, y: Math.random() * H,
      vx: -14 + Math.random() * 22, vy: 26 + Math.random() * 70,
      r: 0.8 + Math.random() * 2.2, a: 0.25 + Math.random() * 0.55,
    });
  }
  return f;
}
export function updateSnow(f: Flake[], dt: number, t: number, wind: number) {
  for (const s of f) {
    s.x += (s.vx + Math.sin(t * 0.8 + s.y * 0.02) * 12 + wind) * dt;
    s.y += s.vy * dt;
    if (s.y > H + 4) { s.y = -4; s.x = Math.random() * W; }
    if (s.x < -6) s.x = W + 4;
    if (s.x > W + 6) s.x = -4;
  }
}
export function drawSnow(ctx: CanvasRenderingContext2D, f: Flake[]) {
  ctx.fillStyle = '#ffffff';
  for (const s of f) {
    ctx.globalAlpha = s.a;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* --------------------------------- fighter -------------------------------- */

export type RenderFighter = {
  x: number; y: number; facing: number;
  state: string; stateT: number; moveKind: string | null; moveProgress: number;
  animPulse?: number;
  moveT?: number;
  crouch: boolean; blocking: boolean; onGround: boolean; vx: number; vy: number;
  palette: Palette; build: number; flash: number; hurt: number; hasBottle: boolean;
  superGlow: number;
  /** true → player-* sprites; false → enemy-* */
  isPlayer: boolean;
  /** FighterDef.id — used for enemy hue-rotate (Valera = 0) */
  defId: string;
};

export function drawShadow(ctx: CanvasRenderingContext2D, f: RenderFighter) {
  const h = Math.max(0, GROUND - f.y);
  const s = clamp(1 - h / 420, 0.25, 1);
  ctx.save();
  ctx.globalAlpha = 0.38 * s;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(f.x, GROUND + 4, 34 * s * f.build, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawFighter(ctx: CanvasRenderingContext2D, f: RenderFighter, t: number) {
  const { img, squashY } = resolveSprite(
    f.isPlayer, f.state, f.moveKind, f.stateT, f.onGround,
    f.crouch || f.state === 'crouch', f.blocking || f.state === 'block',
  );

  // Super glow under feet / body
  if (f.superGlow > 0) {
    ctx.save();
    const g = ctx.createRadialGradient(f.x, f.y - 70, 4, f.x, f.y - 70, 120);
    g.addColorStop(0, `rgba(255,220,140,${0.35 * f.superGlow})`);
    g.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(f.x - 120, f.y - 190, 240, 200);
    ctx.restore();
  }

  if (img) {
    drawSpriteBody(ctx, f, img, squashY, t);
  } else {
    // Brief procedural fallback if sprites not loaded yet
    drawProceduralFallback(ctx, f, t);
  }
}

const TARGET_H = 240;
let spriteScratch: HTMLCanvasElement | null = null;
let spriteScratchCtx: CanvasRenderingContext2D | null = null;

function getSpriteScratch(w: number, h: number): CanvasRenderingContext2D {
  if (!spriteScratch) {
    spriteScratch = document.createElement('canvas');
    spriteScratchCtx = spriteScratch.getContext('2d', { alpha: true })!;
  }
  const c = spriteScratch;
  const g = spriteScratchCtx!;
  const bw = Math.max(1, Math.ceil(w));
  const bh = Math.max(1, Math.ceil(h));
  if (c.width < bw || c.height < bh) {
    c.width = bw;
    c.height = bh;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  return g;
}

function drawSpriteBody(
  ctx: CanvasRenderingContext2D,
  f: RenderFighter,
  img: HTMLImageElement,
  squashY: number,
  _t: number,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (iw <= 0 || ih <= 0) {
    drawProceduralFallback(ctx, f, _t);
    return;
  }

  let scale = (TARGET_H * f.build) / ih;
  // Replay feel: punch/kick stretch each time moveProgress restarts
  let squashX = 1;
  let scaleSquashY = squashY;
  if (f.state === 'attack') {
    const mp = f.moveProgress || 0;
    const punch = mp < 0.45 ? Math.pow(mp / 0.45, 0.7) : 1 - Math.pow((mp - 0.45) / 0.55, 1.4);
    const e = Math.max(0, Math.min(1, punch));
    squashX = 1 + 0.12 * e;
    scaleSquashY = squashY * (1 - 0.08 * e);
    scale *= 1 + 0.04 * e;
  }
  const dw = iw * scale * squashX;
  const dh = ih * scale;
  const facing = f.facing >= 0 ? 1 : -1;

  // Knockdown: tip toward ground a bit
  const down = f.state === 'knockdown' || f.state === 'ko';
  let rot = 0;
  let yOff = 0;
  if (down) {
    const kt = clamp(f.stateT * 5, 0, 1);
    rot = -lerp(0, Math.PI / 2 - 0.15, kt) * facing;
    yOff = lerp(0, dh * 0.15, kt);
  }

  // Compose sprite (+ optional white flash) on scratch so filters stay local
  const g = getSpriteScratch(dw, dh);
  g.drawImage(img, 0, 0, dw, dh);
  if (f.flash > 0) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(255,255,255,${Math.min(0.75, f.flash * 0.9)})`;
    g.fillRect(0, 0, dw, dh);
    g.globalCompositeOperation = 'source-over';
  }

  ctx.save();
  // Feet-anchored at (f.x, f.y)
  ctx.translate(f.x, f.y + yOff);
  ctx.rotate(rot);
  ctx.scale(facing, scaleSquashY);

  // Enemy palette tint (Valera / hero = none)
  let filter = 'none';
  if (!f.isPlayer) {
    const hue = enemyHue(f.defId);
    if (hue !== 0) filter = `hue-rotate(${hue}deg) saturate(1.15) contrast(1.05)`;
  }
  if (f.flash > 0) {
    const flashBit = `brightness(${(1 + f.flash * 1.2).toFixed(2)})`;
    filter = filter === 'none' ? flashBit : `${filter} ${flashBit}`;
  }
  ctx.filter = filter;
  ctx.drawImage(spriteScratch!, 0, 0, dw, dh, -dw / 2, -dh, dw, dh);
  ctx.filter = 'none';
  ctx.restore();
}

/** Minimal stick fallback — only when image missing */
function drawProceduralFallback(ctx: CanvasRenderingContext2D, f: RenderFighter, t: number) {
  const p = f.palette;
  const s = f.build;
  const dir = f.facing >= 0 ? 1 : -1;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.scale(dir, 1);
  const bob = f.onGround && (f.state === 'idle' || f.state === 'walk') ? Math.sin(t * 3.4) * 2 : 0;
  const hipY = -62 * s + bob;
  const shoY = -112 * s + bob;
  const headY = shoY - 20 * s;
  // legs
  seg(ctx, -6 * s, hipY, -10 * s, 0, 12 * s, p.pants);
  seg(ctx, 6 * s, hipY, 10 * s, 0, 12 * s, p.pants);
  // torso
  ctx.fillStyle = p.coat;
  rr(ctx, -18 * s, shoY, 36 * s, hipY - shoY + 8, 8);
  ctx.fill();
  // head
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.ellipse(0, headY, 14 * s, 16 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.hat;
  ctx.beginPath();
  ctx.ellipse(0, headY - 10 * s, 16 * s, 11 * s, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  if (f.flash > 0) {
    ctx.globalAlpha = 0.5 * f.flash;
    ctx.fillStyle = '#fff';
    rr(ctx, -22 * s, headY - 28 * s, 44 * s, -hipY + 40 * s, 10);
    ctx.fill();
  }
  ctx.restore();
}
