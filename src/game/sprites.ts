/** Combat bitmap sprites — Vite-bundled (also mirrored in public/images/) */

import playerIdle from '../assets/combat/player-idle.webp';
import playerWalk0 from '../assets/combat/player-walk0.webp';
import playerWalk1 from '../assets/combat/player-walk1.webp';
import playerWalk2 from '../assets/combat/player-walk2.webp';
import playerWalk3 from '../assets/combat/player-walk3.webp';
import playerWalk from '../assets/combat/player-walk.webp';
import playerPunch from '../assets/combat/player-punch.webp';
import playerKick from '../assets/combat/player-kick.webp';
import playerBlock from '../assets/combat/player-block.webp';
import playerSpecial from '../assets/combat/player-special.webp';
import playerHurt from '../assets/combat/player-hurt.webp';
import playerWin from '../assets/combat/player-win.webp';
import enemyIdle from '../assets/combat/enemy-idle.webp';
import enemyWalk0 from '../assets/combat/enemy-walk0.webp';
import enemyWalk1 from '../assets/combat/enemy-walk1.webp';
import enemyWalk2 from '../assets/combat/enemy-walk2.webp';
import enemyWalk3 from '../assets/combat/enemy-walk3.webp';
import enemyWalk from '../assets/combat/enemy-walk.webp';
import enemyPunch from '../assets/combat/enemy-punch.webp';
import enemyKick from '../assets/combat/enemy-kick.webp';
import enemyBlock from '../assets/combat/enemy-block.webp';
import enemySpecial from '../assets/combat/enemy-special.webp';
import enemyHurt from '../assets/combat/enemy-hurt.webp';

const URLS: Record<string, string> = {
  'player-idle': playerIdle,
  'player-walk0': playerWalk0,
  'player-walk1': playerWalk1,
  'player-walk2': playerWalk2,
  'player-walk3': playerWalk3,
  'player-walk': playerWalk,
  'player-punch': playerPunch,
  'player-kick': playerKick,
  'player-block': playerBlock,
  'player-special': playerSpecial,
  'player-hurt': playerHurt,
  'player-win': playerWin,
  'enemy-idle': enemyIdle,
  'enemy-walk0': enemyWalk0,
  'enemy-walk1': enemyWalk1,
  'enemy-walk2': enemyWalk2,
  'enemy-walk3': enemyWalk3,
  'enemy-walk': enemyWalk,
  'enemy-punch': enemyPunch,
  'enemy-kick': enemyKick,
  'enemy-block': enemyBlock,
  'enemy-special': enemySpecial,
  'enemy-hurt': enemyHurt,
};

const cache = new Map<string, HTMLImageElement>();
let loadPromise: Promise<void> | null = null;
let ready = false;

function loadOne(key: string, src: string): Promise<void> {
  return new Promise((resolve) => {
    const existing = cache.get(key);
    if (existing && existing.complete && existing.naturalWidth > 0) {
      resolve();
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      cache.set(key, img);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
    cache.set(key, img);
  });
}

/** Preload all combat sprites. Safe to call multiple times. */
export function preloadSprites(): Promise<void> {
  if (ready) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all(
    Object.entries(URLS).map(([k, src]) => loadOne(k, src)),
  ).then(() => {
    ready = Object.keys(URLS).some((k) => {
      const im = cache.get(k);
      return !!(im && im.complete && im.naturalWidth > 0);
    });
  });
  return loadPromise;
}

export function spritesReady(): boolean {
  return ready;
}

export function getSprite(key: string): HTMLImageElement | null {
  const im = cache.get(key);
  if (im && im.complete && im.naturalWidth > 0) return im;
  return null;
}

/** Hue-rotate degrees for non-Valera enemy sprites (base art = Valera). */
export function enemyHue(id: string): number {
  if (!id || id === 'valera') return 0;
  const table: Record<string, number> = {
    vova: 40,
    krys: 280,
    zina: 320,
    sanka: 90,
    gosha: 180,
    mitya: 210,
    king: 15,
    fedya: 50,
    baron: 350,
  };
  if (table[id] != null) return table[id];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export type FighterSpritePick = {
  key: string;
  squashY?: number;
};

/** Map fighter state/move → sprite key (without player-/enemy- prefix). */
export function pickSpritePose(
  state: string,
  moveKind: string | null,
  stateT: number,
  onGround: boolean,
  crouch: boolean,
  isHero: boolean,
  blocking = false,
): FighterSpritePick {
  const walkFrame = Math.floor(Math.max(0, stateT) * 10) % 4;

  if (state === 'victory') {
    return { key: isHero ? 'win' : 'idle' };
  }
  if (state === 'hitstun' || state === 'knockdown' || state === 'ko') {
    return { key: 'hurt' };
  }

  if (state === 'attack' && moveKind) {
    switch (moveKind) {
      case 'jab':
      case 'straight':
      case 'airpunch':
      case 'uppercut':
        return { key: 'punch' };
      case 'roundhouse':
      case 'sweep':
      case 'airkick':
        return { key: 'kick' };
      case 'super':
      case 'throw':
        return { key: 'special' };
      default:
        return { key: 'punch' };
    }
  }

  if (state === 'block' || blocking) {
    return { key: 'block' };
  }

  if (state === 'walk') {
    return { key: `walk${walkFrame}` };
  }

  if (state === 'jump' || !onGround) {
    return { key: 'idle' };
  }

  if (state === 'crouch' || crouch) {
    return { key: 'block', squashY: 0.85 };
  }

  return { key: 'idle' };
}

export function resolveSprite(
  isPlayer: boolean,
  state: string,
  moveKind: string | null,
  stateT: number,
  onGround: boolean,
  crouch: boolean,
  blocking = false,
): { img: HTMLImageElement | null; squashY: number; tried: string } {
  const prefix = isPlayer ? 'player' : 'enemy';
  const pose = pickSpritePose(state, moveKind, stateT, onGround, crouch, isPlayer, blocking);
  const primary = `${prefix}-${pose.key}`;
  let img = getSprite(primary);
  if (!img && pose.key.startsWith('walk')) {
    img = getSprite(`${prefix}-walk`) || getSprite(`${prefix}-idle`);
  }
  if (!img && pose.key === 'win') {
    img = getSprite(`${prefix}-idle`);
  }
  if (!img) {
    img = getSprite(`${prefix}-idle`);
  }
  return { img, squashY: pose.squashY ?? 1, tried: primary };
}
void preloadSprites();
