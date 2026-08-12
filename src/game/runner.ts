import { W, H, FighterDef } from './data';
import { Game, InputState, emptyInput, HudState, GameOptions } from './engine';
import { renderGame, resetHudSmoothing } from './renderer';
import { unlockAudio } from './audio';
import { preloadSprites } from './sprites';

const KEYMAP: Record<string, keyof InputState> = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up', Space: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyJ: 'punch', KeyZ: 'punch',
  KeyK: 'kick', KeyX: 'kick',
  KeyL: 'block', KeyC: 'block', ShiftLeft: 'block',
  KeyU: 'special', KeyV: 'special', KeyE: 'special',
};

export class GameRunner {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  game: Game;
  raf = 0;
  last = 0;
  acc = 0;
  paused = false;
  running = false;
  keys: InputState = emptyInput();
  touch: InputState = emptyInput();
  onHud: (h: HudState) => void;
  onGameOver: (score: number, stage: number, win: boolean) => void;
  onPauseRequest: () => void;
  hudTimer = 0;
  time = 0;
  ro: ResizeObserver | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    def: FighterDef,
    cb: { onHud: (h: HudState) => void; onGameOver: (s: number, st: number, w: boolean) => void; onPauseRequest: () => void },
    opts: GameOptions = {},
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.onHud = cb.onHud;
    this.onGameOver = cb.onGameOver;
    this.onPauseRequest = cb.onPauseRequest;
    this.game = new Game(def, {
      onHud: (h) => this.onHud(h),
      onGameOver: (s, st, w) => this.onGameOver(s, st, w),
    }, opts);
    resetHudSmoothing();
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
    }
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keydown);
    window.addEventListener('keyup', this.keyup);
    window.addEventListener('blur', this.blur);
  }

  resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const cw = Math.max(1, Math.round(rect.width * dpr));
    const ch = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
  };

  keydown = (e: KeyboardEvent) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      this.onPauseRequest();
      return;
    }
    const k = KEYMAP[e.code];
    if (k) {
      e.preventDefault();
      unlockAudio();
      this.keys[k] = true;
    }
  };
  keyup = (e: KeyboardEvent) => {
    const k = KEYMAP[e.code];
    if (k) {
      e.preventDefault();
      this.keys[k] = false;
    }
  };
  blur = () => {
    this.keys = emptyInput();
    this.touch = emptyInput();
  };

  setTouch(k: keyof InputState, v: boolean) {
    this.touch[k] = v;
    unlockAudio();
  }

  merged(): InputState {
    const o = emptyInput();
    (Object.keys(o) as (keyof InputState)[]).forEach((k) => {
      o[k] = this.keys[k] || this.touch[k];
    });
    return o;
  }

  start() {
    if (this.running) return;
    void preloadSprites();
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.last = performance.now();
    if (p) this.keys = emptyInput();
  }

  loop = (ts: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > 0.25) dt = 0.25;

    if (!this.paused) {
      this.time += dt;
      this.acc += dt;
      const step = 1 / 120;
      let steps = 0;
      while (this.acc >= step && steps < 12) {
        this.game.setPlayerInput(this.merged());
        this.game.update(step);
        this.acc -= step;
        steps++;
      }
      this.hudTimer += dt;
      if (this.hudTimer > 0.1) {
        this.hudTimer = 0;
        this.game.emitHud();
      }
    }

    const ctx = this.ctx;
    const scale = Math.min(this.canvas.width / W, this.canvas.height / H);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate((this.canvas.width - W * scale) / 2, (this.canvas.height - H * scale) / 2);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    renderGame(ctx, this.game, this.time, this.paused ? 0 : Math.min(dt, 1 / 30));
    ctx.restore();
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    this.running = false;
    this.ro?.disconnect();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keydown);
    window.removeEventListener('keyup', this.keyup);
    window.removeEventListener('blur', this.blur);
  }
}
