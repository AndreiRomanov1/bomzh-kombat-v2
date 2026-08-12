import arenaYard from './arena-yard-bg.webp';
import playerPortrait from './player-portrait.webp';
import enemyPortrait from './enemy-portrait.webp';
import playerIdle from './player-idle.webp';
import enemyIdle from './enemy-idle.webp';
import propTrash from './prop-trash.webp';
import propCart from './prop-cart.webp';
import propPigeon from './prop-pigeon.webp';
import propBottle from './prop-bottle.webp';
import propCardboard from './prop-cardboard.webp';
import logoBomzh from './logo-bomzh.webp';

export const ART = {
  arenaYard,
  playerPortrait,
  enemyPortrait,
  playerIdle,
  enemyIdle,
  propTrash,
  propCart,
  propPigeon,
  propBottle,
  propCardboard,
  logoBomzh,
  // public/ui drops (Props & UI Kit)
  bannerFrame: '/ui/banner-frame.png',
  teaserBaron: '/ui/teaser-baron.png',
  propLantern: '/ui/prop-lantern.png',
  propAtticDebris: '/ui/prop-attic-debris.png',
} as const;

/** CSS filter approximating palette tint for enemy portraits */
export function portraitFilter(coat: string, isHero = false): string {
  if (isHero) return 'none';
  // hash hue from coat hex
  const h = coat.replace('#', '');
  if (h.length < 6) return 'saturate(1.1)';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // rough hue rotate from average color
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0;
  if (max !== min) {
    const d = max - min;
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  // base enemy portrait is cool/blue-ish; rotate toward coat hue
  const base = 210;
  const rot = ((hue - base) + 360) % 360;
  const sat = 1.05 + (max - min) / 255 * 0.4;
  return `hue-rotate(${rot.toFixed(0)}deg) saturate(${sat.toFixed(2)}) contrast(1.05)`;
}
