import { W, GROUND, GRAVITY, MOVES, MoveDef, MoveKind, FighterDef, OPPONENTS } from './data';
import { RenderFighter } from './draw';
import { SFX } from './audio';

export type InputState = {
  left: boolean; right: boolean; up: boolean; down: boolean;
  punch: boolean; kick: boolean; block: boolean; special: boolean;
};
export const emptyInput = (): InputState => ({
  left: false, right: false, up: false, down: false,
  punch: false, kick: false, block: false, special: false,
});

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export type FState =
  | 'idle' | 'walk' | 'jump' | 'crouch' | 'block' | 'attack'
  | 'hitstun' | 'knockdown' | 'getup' | 'ko' | 'victory';

export class Fighter {
  def: FighterDef;
  x = 0; y = GROUND; vx = 0; vy = 0;
  facing = 1;
  hp: number; maxHp: number;
  meter = 0;
  state: FState = 'idle';
  stateT = 0;
  move: MoveDef | null = null;
  moveT = 0;
  moveKind: MoveKind | 'throw' | null = null;
  hasHit = false;
  animPulse = 0;
  hitstop = 0;
  flash = 0;
  crouch = false;
  blocking = false;
  comboHits = 0;
  comboT = 0;
  invuln = 0;
  chain = false;
  input: InputState = emptyInput();
  prev: InputState = emptyInput();
  isPlayer: boolean;
  // ai
  aggro = 0.5; react = 0.3; skill = 0.4;
  aiTimer = 0; aiMode: 'approach' | 'retreat' | 'wait' | 'attack' | 'block' | 'jump' | 'flash' | 'collapse' = 'wait';
  aiActed = false;
  /** Fedya: flash cooldown / Baron: collapse cooldown */
  bossCd = 0;
  /** Fedya rage jabs queued after flash */
  jabQueue = 0;

  constructor(def: FighterDef, x: number, facing: number, isPlayer: boolean) {
    this.def = def;
    this.x = x;
    this.facing = facing;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.isPlayer = isPlayer;
  }

  get onGround() { return this.y >= GROUND - 0.5; }
  get halfW() { return 26 * this.def.build; }
  get height() { return (this.crouch ? 92 : 148) * this.def.build; }

  hurtbox() {
    const top = this.y - this.height;
    return { x: this.x - this.halfW, y: top, w: this.halfW * 2, h: this.height };
  }

  canAct() {
    return this.state !== 'hitstun' && this.state !== 'knockdown' && this.state !== 'ko' &&
      this.state !== 'getup' && this.state !== 'victory' && this.hitstop <= 0;
  }

  setState(s: FState) {
    if (this.state === s) return;
    this.state = s;
    this.stateT = 0;
  }

  startMove(kind: MoveKind | 'throw', def: MoveDef) {
    this.move = def;
    this.moveKind = kind;
    this.moveT = 0;
    this.hasHit = false;
    this.chain = false;
    this.animPulse = (this.animPulse || 0) + 1;
    this.stateT = 0;
    this.blocking = false;
    this.crouch = kind === 'sweep';
    // Direct assign: setState('attack') no-ops when already attacking (mash/cancel)
    this.state = 'attack';
    this.stateT = 0;
    if (this.onGround) this.vx *= 0.2;
  }

  get moveDuration() {
    return this.move ? this.move.startup + this.move.active + this.move.recovery : 0;
  }

  takeHit(dmg: number, hitstun: number, kbx: number, kby: number, blocked: boolean) {
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 1;
    if (blocked) {
      this.vx += kbx * 0.35;
      this.setState('block');
      this.stateT = -hitstun * 0.5;
      return;
    }
    this.move = null;
    this.moveKind = null;
    this.comboHits = 0;
    this.crouch = false;
    this.blocking = false;
    if (kby < -300 || this.hp <= 0) {
      this.vy = kby < -300 ? kby : -420;
      this.vx = kbx * 1.1;
      this.setState('knockdown');
    } else {
      this.vx = kbx;
      if (!this.onGround) this.vy = Math.min(this.vy, -180);
      this.setState('hitstun');
      this.stateT = -hitstun;
    }
  }

  update(dt: number) {
    this.flash = Math.max(0, this.flash - dt * 5);
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.stateT += dt;
    this.comboT = Math.max(0, this.comboT - dt);
    if (this.comboT === 0) this.comboHits = 0;
    this.invuln = Math.max(0, this.invuln - dt);

    const inp = this.input;
    const speed = 250 * this.def.speed;

    if (this.state === 'ko') {
      this.physics(dt);
      return;
    }

    if (this.state === 'knockdown') {
      this.physics(dt);
      if (this.onGround && this.stateT > 0.15) {
        this.vx *= 0.82;
        if (this.hp <= 0) { this.setState('ko'); return; }
        if (this.stateT > 0.95) { this.setState('getup'); this.invuln = 0.35; }
      }
      return;
    }
    if (this.state === 'getup') {
      this.vx *= 0.7;
      this.physics(dt);
      if (this.stateT > 0.3) this.setState('idle');
      return;
    }
    if (this.state === 'hitstun') {
      this.vx *= this.onGround ? 0.86 : 0.99;
      this.physics(dt);
      if (this.stateT >= 0) this.setState('idle');
      return;
    }
    if (this.state === 'victory') { this.vx = 0; this.physics(dt); return; }

    // --- attacking ---
    if (this.state === 'attack' && this.move) {
      this.moveT += dt;
      const inRecovery = this.moveT > this.move.startup + this.move.active;
      // chain / cancel window
      if (inRecovery && !this.chain) {
        if (inp.punch && !this.prev.punch) {
          this.chain = true;
          // Recovery cancel: mash restarts jab (combo upgrade only after a connected jab)
          if (this.moveKind === 'jab' && this.hasHit) this.startMove('straight', MOVES.straight);
          else this.startMove('jab', MOVES.jab);
          return;
        } else if (inp.kick && !this.prev.kick) {
          this.chain = true;
          if ((this.moveKind === 'jab' || this.moveKind === 'straight') && this.hasHit) this.startMove('roundhouse', MOVES.roundhouse);
          else this.startMove('roundhouse', MOVES.roundhouse);
          return;
        }
      }
      this.vx *= this.onGround ? 0.85 : 1;
      this.physics(dt);
      if (this.moveT >= this.moveDuration) {
        this.move = null; this.moveKind = null;
        this.setState(this.onGround ? 'idle' : 'jump');
      }
      return;
    }

    // --- free movement ---
    this.crouch = this.onGround && inp.down;
    this.blocking = this.onGround && inp.block && !this.crouch ? true : this.onGround && inp.block;

    if (this.blocking) {
      this.vx *= 0.7;
      this.setState('block');
    } else if (this.crouch) {
      this.vx *= 0.6;
      this.setState('crouch');
    } else if (this.onGround) {
      let move = 0;
      if (inp.left) move -= 1;
      if (inp.right) move += 1;
      if (move !== 0) {
        const back = move !== this.facing;
        this.vx = move * speed * (back ? 0.78 : 1);
        this.setState('walk');
      } else {
        this.vx *= 0.6;
        this.setState('idle');
      }
      if (inp.up && !this.prev.up) {
        this.vy = -820 * this.def.jump;
        this.setState('jump');
        SFX.jump();
      }
    } else {
      // air control
      let move = 0;
      if (inp.left) move -= 1;
      if (inp.right) move += 1;
      this.vx += move * 240 * dt;
      this.vx = clamp(this.vx, -speed * 1.15, speed * 1.15);
      this.setState('jump');
    }

    this.physics(dt);
  }

  physics(dt: number) {
    this.x += this.vx * dt;
    if (!this.onGround || this.vy < 0) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y >= GROUND) {
        this.y = GROUND;
        this.vy = 0;
        if (this.state === 'jump') this.setState('idle');
        SFX.land();
      }
    } else {
      this.y = GROUND;
      this.vy = 0;
    }
    this.x = clamp(this.x, 40, W - 40);
  }

  render(): RenderFighter {
    return {
      x: this.x, y: this.y, facing: this.facing,
      state: this.state, stateT: this.stateT,
      moveKind: this.moveKind, moveProgress: this.move ? clamp(this.moveT / this.moveDuration, 0, 1) : 0, animPulse: this.animPulse || 0, moveT: this.moveT,
      crouch: this.crouch, blocking: this.blocking, onGround: this.onGround,
      vx: this.vx, vy: this.vy, palette: this.def.palette, build: this.def.build,
      flash: this.flash, hurt: 0, hasBottle: false,
      superGlow: this.meter >= 100 ? 0.6 + Math.sin(performance.now() / 120) * 0.25 : 0,
      isPlayer: this.isPlayer,
      defId: this.def.id,
    };
  }
}

/* -------------------------------- particles ------------------------------- */

export type Particle = {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  size: number; color: string; kind: 'blob' | 'spark' | 'ring' | 'shard' | 'smoke';
  grav: number; rot: number; vr: number;
};

export type FloatText = { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; size: number };

/* ------------------------------- projectiles ------------------------------ */

export type Projectile = { x: number; y: number; vx: number; vy: number; rot: number; owner: Fighter; dead: boolean; dmg: number; kind: string };

/* ---------------------------------- game ---------------------------------- */

export type Phase = 'intro' | 'fight' | 'ko' | 'finisher' | 'roundover' | 'matchover' | 'gameover';

export type GameEvents = {
  onHud: (h: HudState) => void;
  onGameOver: (score: number, stage: number, win: boolean) => void;
};

export type GameOptions = {
  startStage?: number;
  startScore?: number;
  /** If true, stop after each stage win (App shows tower). Default true. */
  pauseBetweenStages?: boolean;
  /** Free fight: only one opponent, no auto ladder inside engine */
  singleFight?: boolean;
};

export type HudState = {
  phase: Phase; score: number; stage: number; timer: number;
  playerHp: number; enemyHp: number; combo: number;
};

export class Game {
  p: Fighter;
  e: Fighter;
  particles: Particle[] = [];
  texts: FloatText[] = [];
  projectiles: Projectile[] = [];
  shake = 0;
  shakeX = 0; shakeY = 0;
  hitstopGlobal = 0;
  timeScale = 1;
  score = 0;
  stage = 0;
  timer = 60;
  phase: Phase = 'intro';
  phaseT = 0;
  banner = '';
  bannerT = 0;
  camX = W / 2; camZoom = 1;
  fatalityDone = false;
  perfect = true;
  events: GameEvents;
  playerDef: FighterDef;
  flashWhite = 0;
  /** Player blind / input lag after Fedya flash */
  blindT = 0;
  /** Shadow telegraph zones for Baron bottles: {x,t} */
  telegraphs: { x: number; t: number; max: number }[] = [];
  /** Baron phase-2 aura flip */
  baronPhase2 = false;

  pauseBetweenStages = true;
  singleFight = false;

  constructor(playerDef: FighterDef, events: GameEvents, opts: GameOptions = {}) {
    this.playerDef = playerDef;
    this.events = events;
    this.pauseBetweenStages = opts.pauseBetweenStages !== false;
    this.singleFight = !!opts.singleFight;
    this.p = new Fighter(playerDef, 300, 1, true);
    const start = Math.max(0, Math.min(OPPONENTS.length - 1, opts.startStage ?? 0));
    this.score = Math.max(0, opts.startScore ?? 0);
    this.e = this.makeEnemy(start);
    this.startStage(start, true);
  }

  makeEnemy(i: number) {
    const d = OPPONENTS[Math.min(i, OPPONENTS.length - 1)];
    const scale = 1 + Math.max(0, i - OPPONENTS.length + 1) * 0.15;
    const f = new Fighter({ ...d, hp: Math.round(d.hp * scale) }, 660, -1, false);
    f.aggro = Math.min(0.92, d.aggro + Math.max(0, i - OPPONENTS.length + 1) * 0.05);
    f.react = Math.max(0.09, d.react - Math.max(0, i - OPPONENTS.length + 1) * 0.03);
    f.skill = Math.min(0.95, d.skill + Math.max(0, i - OPPONENTS.length + 1) * 0.05);
    return f;
  }

  startStage(i: number, first = false) {
    this.stage = i;
    this.e = this.makeEnemy(i);
    this.p.x = 300; this.p.y = GROUND; this.p.vx = 0; this.p.vy = 0;
    this.p.facing = 1;
    this.p.state = 'idle'; this.p.move = null; this.p.moveKind = null; this.p.comboHits = 0;
    if (first) this.p.hp = this.p.maxHp;
    else this.p.hp = Math.min(this.p.maxHp, this.p.hp + this.p.maxHp * 0.35);
    this.p.meter = first ? 0 : Math.min(100, this.p.meter + 25);
    this.timer = 60;
    this.perfect = true;
    this.fatalityDone = false;
    this.blindT = 0;
    this.telegraphs = [];
    this.baronPhase2 = false;
    this.phase = 'intro';
    this.phaseT = 0;
    this.setBanner(`БОЙ ${i + 1}`, 1.1);
    SFX.bell();
  }

  setBanner(text: string, t: number) {
    this.banner = text;
    this.bannerT = t;
  }

  /* ------------------------------ particles ------------------------------ */
  burst(x: number, y: number, n: number, color: string, kind: Particle['kind'], power = 1) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      const sp = rnd(50, 320) * power;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * power,
        life: rnd(0.3, 0.85), max: 0.85, size: rnd(2, 6) * power,
        color, kind, grav: kind === 'smoke' ? -40 : 900, rot: rnd(0, 6), vr: rnd(-12, 12),
      });
    }
    if (this.particles.length > 480) this.particles.splice(0, this.particles.length - 480);
  }

  landDust(x: number) {
    for (let i = 0; i < 8; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      this.particles.push({
        x: x + rnd(-10, 10), y: GROUND + 2,
        vx: dir * rnd(40, 170), vy: rnd(-120, -30),
        life: rnd(0.25, 0.55), max: 0.55, size: rnd(2, 5),
        color: 'rgba(226,236,246,0.85)', kind: 'blob', grav: 420, rot: 0, vr: 0,
      });
    }
    this.shake = Math.max(this.shake, 2);
  }

  ring(x: number, y: number, color: string, size = 1) {
    this.particles.push({
      x, y, vx: 0, vy: 0, life: 0.28, max: 0.28, size: 12 * size, color, kind: 'ring', grav: 0, rot: 0, vr: 0,
    });
  }

  text(x: number, y: number, t: string, color: string, size = 26) {
    this.texts.push({ x, y, vy: -60, life: 0.9, max: 0.9, text: t, color, size });
  }

  addScore(n: number, x?: number, y?: number, label?: string) {
    this.score += n;
    if (x !== undefined && y !== undefined) this.text(x, y, label ?? `+${n}`, '#f2b544', 22);
  }

  /* --------------------------------- input -------------------------------- */

  setPlayerInput(inp: InputState) {
    this.p.input = inp;
  }

  /* ---------------------------------- AI ---------------------------------- */

  updateAI(dt: number) {
    const e = this.e, p = this.p;
    const inp = e.input;
    inp.left = inp.right = inp.up = inp.down = inp.punch = inp.kick = inp.block = inp.special = false;
    if (this.phase !== 'fight' || !e.canAct()) return;

    const dist = Math.abs(p.x - e.x);
    const dirToP = Math.sign(p.x - e.x) || 1;
    e.aiTimer -= dt;
    e.bossCd = Math.max(0, e.bossCd - dt);

    const id = e.def.id;
    const hpRatio = e.hp / e.maxHp;

    // Baron phase 2 enter
    if (id === 'baron' && !this.baronPhase2 && hpRatio <= 0.4) {
      this.baronPhase2 = true;
      e.def = { ...e.def, palette: { ...e.def.palette, aura: '#c8202a' } };
      this.setBanner('ОБВАЛ!', 0.8);
      this.shake = Math.max(this.shake, 10);
      SFX.hitHeavy();
    }

    // Baron collapse AoE every 4s in phase 2
    if (id === 'baron' && this.baronPhase2 && e.bossCd <= 0 && e.aiMode !== 'collapse') {
      e.aiMode = 'collapse';
      e.aiTimer = 0.55;
      e.aiActed = false;
      e.bossCd = 4;
      this.setBanner('↓ ПРЫГАЙ!', 0.55);
      this.shake = Math.max(this.shake, 8);
      SFX.land();
    }

    // Fedya flash pattern
    if (id === 'fedya' && e.bossCd <= 0 && e.canAct() && e.aiMode !== 'flash') {
      const rage = hpRatio <= 0.5;
      const want = Math.random() < (rage ? 0.55 : 0.28) * dt * 8;
      if (want || (rage && Math.random() < dt * 0.35)) {
        e.aiMode = 'flash';
        e.aiTimer = 0.35 + 0.4 + 0.15; // startup + flash + follow
        e.aiActed = false;
        e.bossCd = rage ? 1.2 : 2.2;
        e.jabQueue = rage ? 2 : 0;
        SFX.whiff(); // telegraph pitch — Sound will swap later
        this.setBanner('ВСПЫШКА!', 0.45);
      }
    }

    // Fedya mid: longer sweep preference handled in attack branch
    // Baron anti-air stronger
    const pAttacking = p.state === 'attack' && p.move && p.moveT < p.move.startup + p.move.active;
    if (pAttacking && dist < 150 && Math.random() < e.skill * dt * 12) {
      e.aiMode = 'block';
      e.aiTimer = rnd(0.25, 0.5);
    }
    if (!p.onGround && dist < (id === 'baron' ? 210 : 170) && Math.random() < e.skill * dt * (id === 'baron' ? 10 : 6)) {
      e.aiMode = 'attack';
      e.aiTimer = 0.35;
      // Baron: enhanced uppercut reach/launch via startMove override below
      inp.down = true;
      inp.punch = true;
      if (id === 'baron') {
        e.aiActed = true;
        e.startMove('uppercut', {
          ...MOVES.uppercut,
          reach: MOVES.uppercut.reach + 28,
          launch: MOVES.uppercut.launch * 1.25,
          damage: MOVES.uppercut.damage + 2,
        });
        SFX.whiff();
        return;
      }
      return;
    }

    // Execute flash follow-up
    if (e.aiMode === 'flash') {
      const elapsed = (0.35 + 0.4 + 0.15) - e.aiTimer;
      if (!e.aiActed && elapsed >= 0.35) {
        e.aiActed = true;
        this.flashWhite = Math.max(this.flashWhite, 0.4);
        this.blindT = Math.max(this.blindT, 0.4);
        this.shake = Math.max(this.shake, 6);
        SFX.super();
      }
      if (elapsed >= 0.75 && e.canAct()) {
        // grab (throw startup) or uppercut
        if (dist < 95 && Math.random() < 0.55) {
          e.startMove('throw', { ...MOVES.jab, startup: 0.08, active: 0.12, recovery: 0.28, damage: 14, reach: 70, hitstun: 0.4, knockback: 240, launch: -80 });
        } else {
          e.startMove('uppercut', MOVES.uppercut);
        }
        SFX.whiff();
        e.aiMode = 'attack';
        e.aiTimer = 0.2;
        // queue jabs after
        if (e.jabQueue > 0) {
          const n = e.jabQueue;
          e.jabQueue = 0;
          let i = 0;
          const jab = () => {
            if (i >= n || this.phase !== 'fight') return;
            if (e.canAct()) {
              e.startMove('jab', MOVES.jab);
              SFX.whiff();
            }
            i++;
            if (i < n) setTimeout(jab, 180);
          };
          setTimeout(jab, 280);
        }
      }
      return;
    }

    // Baron collapse: hurt grounded player in window
    if (e.aiMode === 'collapse') {
      if (!e.aiActed && e.aiTimer < 0.25) {
        e.aiActed = true;
        this.flashWhite = Math.max(this.flashWhite, 0.15);
        this.shake = Math.max(this.shake, 16);
        SFX.hitHeavy();
        if (p.onGround && p.invuln <= 0 && p.state !== 'ko') {
          p.takeHit(12 * e.def.power / p.def.defense, 0.45, (Math.random() < 0.5 ? -1 : 1) * 180, -220, false);
          this.burst(p.x, GROUND - 10, 18, '#8a6a40', 'blob', 1.2);
          if (p.hp <= 0) this.onKO(p);
        } else {
          this.burst(e.x, GROUND - 8, 14, '#8a6a40', 'spark', 1);
        }
      }
      return;
    }

    if (e.aiTimer <= 0) {
      e.aiActed = false;
      const r = Math.random();
      if (dist > 260) {
        if (r < 0.22 && e.meter >= 50) { e.aiMode = 'attack'; e.aiTimer = 0.35; inp.special = true; }
        else if (r < 0.86) { e.aiMode = 'approach'; e.aiTimer = rnd(0.25, 0.7); }
        else { e.aiMode = 'jump'; e.aiTimer = 0.5; }
      } else if (dist > 110) {
        if (r < e.aggro) { e.aiMode = 'approach'; e.aiTimer = rnd(0.18, 0.4); }
        else if (r < e.aggro + 0.18) { e.aiMode = 'jump'; e.aiTimer = 0.5; }
        else if (r < e.aggro + 0.34) { e.aiMode = 'retreat'; e.aiTimer = rnd(0.2, 0.45); }
        else { e.aiMode = 'wait'; e.aiTimer = rnd(0.15, 0.4); }
      } else {
        if (r < 0.62 + e.aggro * 0.25) { e.aiMode = 'attack'; e.aiTimer = rnd(0.22, 0.45); }
        else if (r < 0.82) { e.aiMode = 'block'; e.aiTimer = rnd(0.2, 0.5); }
        else { e.aiMode = 'retreat'; e.aiTimer = rnd(0.15, 0.35); }
      }
    }

    switch (e.aiMode) {
      case 'approach':
        if (dirToP > 0) inp.right = true; else inp.left = true;
        break;
      case 'retreat':
        if (dirToP > 0) inp.left = true; else inp.right = true;
        break;
      case 'block':
        inp.block = true;
        if (Math.random() < 0.35) inp.down = true;
        break;
      case 'jump':
        inp.up = true;
        if (dirToP > 0) inp.right = true; else inp.left = true;
        if (dist < 220 && e.y < GROUND - 60 && Math.random() < 0.2) inp.kick = true;
        break;
      case 'attack': {
        if (e.aiActed) break;
        e.aiActed = true;
        if (e.meter >= 100 && dist < 130 && Math.random() < 0.5) { inp.special = true; break; }
        if (e.meter >= 50 && dist > 180 && Math.random() < 0.65) { inp.special = true; break; }
        const r = Math.random();
        // Fedya lantern arc: preferential long sweep
        if (id === 'fedya' && dist < 140 && r < 0.38) {
          e.startMove('sweep', { ...MOVES.sweep, reach: MOVES.sweep.reach + 20, damage: MOVES.sweep.damage + 1 });
          SFX.whiff();
          break;
        }
        if (dist < 100 && r < 0.22) { inp.down = true; inp.punch = true; }
        else if (dist < 120 && r < 0.42) { inp.down = true; inp.kick = true; }
        else if (r < 0.7) inp.punch = true;
        else inp.kick = true;
        break;
      }
      default:
        if (dist > 190) { if (dirToP > 0) inp.right = true; else inp.left = true; }
        break;
    }
  }

  /* --------------------------- attack initiation -------------------------- */

  handleAttackInput(f: Fighter, foe: Fighter) {
    if (!f.canAct()) return;
    // Allow new attacks during recovery so mashing replays animation each hit
    if (f.state === 'attack' && f.move) {
      const inRecovery = f.moveT > f.move.startup + f.move.active;
      if (!inRecovery) return;
    } else if (f.state === 'attack') {
      return;
    }
    const inp = f.input, prev = f.prev;
    const press = (k: keyof InputState) => inp[k] && !prev[k];

    if (press('special')) {
      if (f.meter >= 100) {
        f.meter = 0;
        const baronSuper = !f.isPlayer && f.def.id === 'baron' && this.baronPhase2;
        f.startMove('super', baronSuper ? { ...MOVES.super, hitstop: 0.2, damage: MOVES.super.damage + 4 } : MOVES.super);
        this.shake = Math.max(this.shake, baronSuper ? 16 : 12);
        this.flashWhite = 0.5;
        this.timeScale = 0.45;
        SFX.super();
        if (f.isPlayer) this.setBanner('ГОП-СТОП!', 0.9);
        else if (baronSuper) this.setBanner('ОБВАЛ!', 0.7);
        return;
      }
      if (f.meter >= 50) {
        f.meter -= 50;
        // Baron: 3 bottles from ceiling with shadow telegraph
        if (!f.isPlayer && f.def.id === 'baron') {
          f.startMove('throw', { ...MOVES.jab, startup: 0.12, active: 0.08, recovery: 0.3, damage: 0 });
          SFX.bottle();
          const targets = [
            this.p.x,
            clamp(this.p.x + rnd(-90, 90), 60, W - 60),
            clamp(this.p.x + rnd(-140, 140), 60, W - 60),
          ];
          for (const tx of targets) {
            this.telegraphs.push({ x: tx, t: 0.45, max: 0.45 });
            setTimeout(() => {
              if (this.phase !== 'fight') return;
              this.projectiles.push({
                x: tx, y: 40, vx: rnd(-40, 40), vy: 420,
                rot: 0, owner: f, dead: false, dmg: 11, kind: 'bottle',
              });
              SFX.bottle();
            }, 450);
          }
          return;
        }
        f.startMove('throw', { ...MOVES.jab, startup: 0.1, active: 0.05, recovery: 0.24, damage: 0 });
        SFX.bottle();
        const dirF = f.facing;
        setTimeout(() => {
          if (f.state === 'attack' && f.moveKind === 'throw') {
            this.projectiles.push({
              x: f.x + dirF * 40, y: f.y - 95 * f.def.build, vx: dirF * 620, vy: -40,
              rot: 0, owner: f, dead: false, dmg: 13, kind: 'bottle',
            });
          }
        }, 100);
        return;
      }
      return;
    }
    if (press('punch')) {
      if (!f.onGround) f.startMove('airpunch', MOVES.airpunch);
      else if (inp.down) f.startMove('uppercut', MOVES.uppercut);
      else f.startMove('jab', MOVES.jab);
      SFX.whiff();
      return;
    }
    if (press('kick')) {
      if (!f.onGround) f.startMove('airkick', MOVES.airkick);
      else if (inp.down) f.startMove('sweep', MOVES.sweep);
      else f.startMove('roundhouse', MOVES.roundhouse);
      SFX.whiff();
      return;
    }
    void foe;
  }

  /* ------------------------------ hit checks ------------------------------ */

  checkHit(a: Fighter, d: Fighter) {
    if (a.state !== 'attack' || !a.move || a.hasHit) return;
    const m = a.move;
    if (a.moveT < m.startup || a.moveT > m.startup + m.active) return;
    if (m.damage <= 0) return;
    if (d.invuln > 0 || d.state === 'ko') return;

    const hx = a.x + a.facing * (a.halfW + m.reach / 2);
    const hy = a.y + m.height * a.def.build;
    const hw = m.reach, hh = m.vsize * a.def.build;
    const box = d.hurtbox();
    const hit =
      Math.abs(hx - (box.x + box.w / 2)) < hw / 2 + box.w / 2 &&
      Math.abs(hy - (box.y + box.h / 2)) < hh / 2 + box.h / 2;
    if (!hit) return;

    a.hasHit = true;
    const facingAway = d.blocking && Math.sign(a.x - d.x) === d.facing;
    const canBlock = facingAway && d.onGround && (!m.low || d.crouch);
    const scale = Math.pow(0.86, a.comboHits) * 0.6 + 0.4;
    let dmg = m.damage * a.def.power / d.def.defense * scale;

    const px = (a.x + d.x) / 2 + a.facing * 10;
    const py = hy;

    if (canBlock) {
      dmg *= 0.12;
      d.takeHit(dmg, 0.18, a.facing * m.knockback, 0, true);
      a.meter = Math.min(100, a.meter + m.meter * 0.35);
      d.meter = Math.min(100, d.meter + m.meter * 0.5);
      this.burst(px, py, 8, '#cfe6ff', 'spark', 0.7);
      this.ring(px, py, 'rgba(180,220,255,0.85)', 0.7);
      this.shake = Math.max(this.shake, 3);
      a.hitstop = d.hitstop = 0.04;
      SFX.block();
      if (a.isPlayer) this.addScore(Math.round(dmg * 4));
      return;
    }

    d.takeHit(dmg, m.hitstun, a.facing * m.knockback, m.launch, false);
    a.comboHits++;
    a.comboT = 1.1;
    a.meter = Math.min(100, a.meter + m.meter);
    d.meter = Math.min(100, d.meter + m.meter * 0.4);
    a.hitstop = d.hitstop = m.hitstop;
    this.shake = Math.max(this.shake, m.shake);
    this.burst(px, py, m.damage > 10 ? 16 : 9, '#c8202a', 'blob', m.damage > 10 ? 1.15 : 0.8);
    this.burst(px, py, 6, '#ffd08a', 'spark', 1);
    this.ring(px, py, 'rgba(255,230,180,0.9)', m.damage > 10 ? 1.4 : 1);
    if (m.damage >= 12) { SFX.hitHeavy(); this.flashWhite = Math.max(this.flashWhite, 0.22); }
    else SFX.hitLight();

    if (a.isPlayer) {
      this.addScore(Math.round(dmg * 12));
      if (a.comboHits >= 2) {
        this.text(d.x, d.y - d.height - 24, `${a.comboHits}x КОМБО!`, '#ffdd66', 24 + a.comboHits * 2);
        this.addScore(a.comboHits * 60);
      }
    } else {
      this.perfect = false;
    }

    if (d.hp <= 0) this.onKO(d);
  }

  onKO(d: Fighter) {
    this.timeScale = 0.3;
    this.phase = 'ko';
    this.phaseT = 0;
    this.shake = 22;
    this.flashWhite = 0.7;
    SFX.ko();
    this.setBanner('НОКАУТ!', 1.6);
    this.burst(d.x, d.y - d.height / 2, 26, '#c8202a', 'blob', 1.3);
  }

  /* --------------------------------- update -------------------------------- */

  update(dtRaw: number) {
    const dt = Math.min(dtRaw, 1 / 30) * this.timeScale;
    const t = dt;

    this.flashWhite = Math.max(0, this.flashWhite - dtRaw * 2.4);
    this.blindT = Math.max(0, this.blindT - dtRaw);
    this.bannerT = Math.max(0, this.bannerT - dtRaw);
    this.phaseT += dtRaw;
    // telegraph countdown
    for (const tg of this.telegraphs) tg.t -= dtRaw;
    this.telegraphs = this.telegraphs.filter((tg) => tg.t > 0);

    // phase machine
    if (this.phase === 'intro') {
      if (this.phaseT > 0.9 && this.banner !== 'ДЕРИСЬ!') this.setBanner('ДЕРИСЬ!', 0.9);
      if (this.phaseT > 1.7) { this.phase = 'fight'; this.phaseT = 0; }
    } else if (this.phase === 'fight') {
      this.timer -= dtRaw;
      if (this.timer <= 0) {
        this.timer = 0;
        if (this.p.hp >= this.e.hp) this.onKO(this.e);
        else this.onKO(this.p);
      }
    } else if (this.phase === 'ko') {
      this.timeScale = Math.min(1, 0.3 + this.phaseT * 0.35);
      if (this.phaseT > 1.9) {
        if (this.e.hp <= 0 && this.p.hp > 0) {
          this.phase = 'finisher';
          this.phaseT = 0;
          this.e.state = 'knockdown';
          this.e.stateT = 0.6;
          this.setBanner('ДОБЕЙ!', 2.6);
        } else {
          this.endMatch(false);
        }
      }
    } else if (this.phase === 'finisher') {
      this.timeScale = 1;
      this.e.hp = 0;
      const dist = Math.abs(this.p.x - this.e.x);
      if (!this.fatalityDone && this.p.input.special && !this.p.prev.special && dist < 170) {
        this.doFatality();
      }
      // Baron: ОТКЛЮЧКА обязательна — авто, если игрок не успел
      if (!this.fatalityDone && this.e.def.id === 'baron' && this.phaseT > 2.2) {
        this.doFatality();
      }
      if (this.phaseT > (this.e.def.id === 'baron' ? 3.6 : 2.8)) this.endMatch(true);
    } else if (this.phase === 'roundover') {
      this.timeScale = 1;
      if (this.phaseT > 2.6) {
        this.startStage(this.stage + 1);
      }
    }

    // fighters
    if (this.phase !== 'gameover' && this.phase !== 'matchover') {
      if (this.phase === 'fight') {
        // Fedya blind: drop attack/special presses (movement still ok, sluggish)
        if (this.blindT > 0) {
          this.p.input = {
            ...this.p.input,
            punch: false, kick: false, special: false,
            left: this.p.input.left && Math.random() > 0.35,
            right: this.p.input.right && Math.random() > 0.35,
          };
        }
        this.updateAI(t);
        this.handleAttackInput(this.p, this.e);
        this.handleAttackInput(this.e, this.p);
      } else {
        this.e.input = emptyInput();
        if (this.phase !== 'finisher') this.p.input = { ...this.p.input, punch: false, kick: false };
      }

      // facing
      if (this.p.canAct() && this.p.state !== 'attack') this.p.facing = this.p.x <= this.e.x ? 1 : -1;
      if (this.e.canAct() && this.e.state !== 'attack') this.e.facing = this.e.x <= this.p.x ? 1 : -1;

      const pAir = !this.p.onGround, eAir = !this.e.onGround;
      this.p.update(t);
      this.e.update(t);
      if (pAir && this.p.onGround) this.landDust(this.p.x);
      if (eAir && this.e.onGround) this.landDust(this.e.x);
      this.separate();

      if (this.phase === 'fight') {
        this.checkHit(this.p, this.e);
        this.checkHit(this.e, this.p);
      }

      this.p.prev = { ...this.p.input };
      this.e.prev = { ...this.e.input };
    }

    this.updateProjectiles(t);
    this.updateParticles(dtRaw);

    // camera
    const mid = (this.p.x + this.e.x) / 2;
    const dist = Math.abs(this.p.x - this.e.x);
    const targetZoom = clamp(1.34 - dist / 950, 1.0, 1.3);
    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dtRaw * 4);
    const halfView = W / (2 * this.camZoom);
    const targetX = clamp(mid, halfView, W - halfView);
    this.camX += (targetX - this.camX) * Math.min(1, dtRaw * 6);

    // shake
    this.shake *= Math.pow(0.0015, dtRaw);
    if (this.shake < 0.3) this.shake = 0;
    this.shakeX = (Math.random() - 0.5) * this.shake * 2;
    this.shakeY = (Math.random() - 0.5) * this.shake * 1.4;

    if (this.phase === 'fight' && this.timeScale < 1) this.timeScale = Math.min(1, this.timeScale + dtRaw * 1.6);
  }

  separate() {
    const a = this.p, b = this.e;
    const minD = a.halfW + b.halfW - 6;
    const d = b.x - a.x;
    const ad = Math.abs(d);
    if (ad < minD && ad > 0.001) {
      const push = (minD - ad) / 2;
      const s = Math.sign(d);
      a.x -= s * push;
      b.x += s * push;
      a.x = clamp(a.x, 40, W - 40);
      b.x = clamp(b.x, 40, W - 40);
    }
  }

  doFatality() {
    this.fatalityDone = true;
    this.timeScale = 0.35;
    this.shake = 26;
    this.flashWhite = 0.9;
    this.setBanner('ОТКЛЮЧКА!', 3);
    SFX.glass();
    SFX.ko();
    const x = this.e.x, y = this.e.y - 40;
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this.burst(x, y - i * 12, 30, '#a8121c', 'blob', 1.5);
        this.burst(x, y - i * 12, 12, '#8ce0a8', 'shard', 1.2);
        this.shake = 20;
      }, i * 120);
    }
    this.addScore(4000, x, y - 120, '+4000 ОТКЛЮЧКА');
    this.p.startMove('super', { ...MOVES.super, damage: 0 });
    setTimeout(() => { this.timeScale = 1; }, 900);
  }

  endMatch(playerWon: boolean) {
    const id = this.e.def.id;
    if (playerWon) {
      const timeBonus = Math.round(this.timer * 40);
      this.addScore(1500 + timeBonus);
      if (this.perfect) this.addScore(2500);
      if (id === 'fedya') this.score = Math.round(this.score * 1.15);
      this.e.state = 'ko';
      this.p.state = 'victory';
      this.p.stateT = 0;
      SFX.win();
      this.emitHud();
      const last = this.stage >= OPPONENTS.length - 1;
      const winBanner =
        id === 'fedya' ? 'СВЕТ ПОГАС' :
        id === 'baron' ? 'ЧЕРДАК ТВОЙ!' :
        (last && !this.singleFight ? 'БАШНЯ ПРОЙДЕНА!' : (this.perfect ? 'ЧИСТАЯ ПОБЕДА!' : 'ПОБЕДА!'));
      if (this.singleFight || this.pauseBetweenStages || last) {
        this.phase = 'matchover';
        this.phaseT = 0;
        this.setBanner(winBanner, 2.6);
        this.events.onGameOver(Math.round(this.score), this.stage + 1, true);
      } else {
        this.phase = 'roundover';
        this.phaseT = 0;
        this.setBanner(winBanner === 'ПОБЕДА!' || winBanner === 'ЧИСТАЯ ПОБЕДА!' ? winBanner : winBanner, 2.4);
      }
    } else {
      this.p.state = 'ko';
      this.phase = 'gameover';
      this.phaseT = 0;
      SFX.lose();
      const loseBanner =
        id === 'fedya' ? 'СГОРЕЛ НА ДВОРЕ' :
        id === 'baron' ? 'ВЫНЕСЛИ НА МУСОР' :
        'ТЫ ПРОИГРАЛ';
      this.setBanner(loseBanner, 3);
      this.emitHud();
      this.events.onGameOver(Math.round(this.score), this.stage + 1, false);
    }
  }

  updateProjectiles(dt: number) {
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.vy += 260 * dt;
      pr.rot += dt * 16 * Math.sign(pr.vx);
      if (pr.x < -40 || pr.x > W + 40 || pr.y > GROUND + 10) {
        pr.dead = true;
        this.burst(pr.x, Math.min(pr.y, GROUND), 10, '#8ce0a8', 'shard', 0.8);
        SFX.glass();
      }
      const target = pr.owner === this.p ? this.e : this.p;
      if (!pr.dead && target.invuln <= 0 && target.state !== 'ko') {
        const b = target.hurtbox();
        if (pr.x > b.x && pr.x < b.x + b.w && pr.y > b.y && pr.y < b.y + b.h) {
          pr.dead = true;
          const blocked = target.blocking && Math.sign(pr.vx) === -target.facing;
          const dmg = blocked ? pr.dmg * 0.15 : pr.dmg;
          target.takeHit(dmg, 0.35, Math.sign(pr.vx) * 240, blocked ? 0 : -120, blocked);
          this.burst(pr.x, pr.y, 16, '#8ce0a8', 'shard', 1.1);
          this.burst(pr.x, pr.y, 8, blocked ? '#cfe6ff' : '#c8202a', 'blob', 0.9);
          this.shake = Math.max(this.shake, blocked ? 4 : 9);
          SFX.glass();
          if (pr.owner === this.p) {
            this.addScore(Math.round(dmg * 12));
          } else this.perfect = false;
          if (target.hp <= 0) this.onKO(target);
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  updateParticles(dt: number) {
    const arr = this.particles;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) { arr.splice(i, 1); continue; }
      if (p.kind !== 'ring') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.grav * dt;
        p.rot += p.vr * dt;
        if (p.y > GROUND + 6 && p.kind !== 'smoke') {
          p.y = GROUND + 6;
          p.vy *= -0.32;
          p.vx *= 0.6;
        }
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y += t.vy * dt;
      t.vy *= 0.94;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  emitHud() {
    this.events.onHud({
      phase: this.phase,
      score: Math.round(this.score),
      stage: this.stage,
      timer: Math.ceil(this.timer),
      playerHp: this.p.hp / this.p.maxHp,
      enemyHp: this.e.hp / this.e.maxHp,
      combo: this.p.comboHits,
    });
  }
}
