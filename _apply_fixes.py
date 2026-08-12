from pathlib import Path

# --- engine.ts: startMove must assign state directly ---
eng = Path('/workspace/bomzh-kombat-v2/src/game/engine.ts')
text = eng.read_text()
old = """    this.stateT = 0;
    this.blocking = false;
    this.crouch = kind === 'sweep';
    this.setState('attack');
    this.stateT = 0;
"""
new = """    this.stateT = 0;
    this.blocking = false;
    this.crouch = kind === 'sweep';
    // Direct assign: setState('attack') no-ops when already attacking (mash/cancel)
    this.state = 'attack';
    this.stateT = 0;
"""
if old not in text:
    raise SystemExit('startMove block not found')
text = text.replace(old, new, 1)

# Ensure handleAttackInput allows recovery cancels (idempotent check)
if "Allow new attacks during recovery so mashing replays animation each hit" not in text:
    raise SystemExit('handleAttackInput recovery comment missing — unexpected')

# In-attack recovery cancel: always restart jab on punch mash (keep kick path)
old_chain = """      if (inRecovery && !this.chain) {
        if (inp.punch && !this.prev.punch) {
          this.chain = true;
          // mash jab or upgrade chain
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
"""
new_chain = """      if (inRecovery && !this.chain) {
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
"""
if old_chain not in text:
    raise SystemExit('chain block not found')
text = text.replace(old_chain, new_chain, 1)
eng.write_text(text)
print('engine.ts patched')

# --- draw.ts: remove unused limb; use let local for squash ---
draw = Path('/workspace/bomzh-kombat-v2/src/game/draw.ts')
d = draw.read_text()

old_limb = """function limb(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  a1: number, l1: number, a2: number, l2: number,
  w1: number, w2: number, c1: string, c2: string,
): [number, number] {
  const mx = x + Math.cos(a1) * l1;
  const my = y + Math.sin(a1) * l1;
  const ex = mx + Math.cos(a1 + a2) * l2;
  const ey = my + Math.sin(a1 + a2) * l2;
  seg(ctx, x, y, mx, my, w1, c1);
  seg(ctx, mx, my, ex, ey, w2, c2);
  return [ex, ey];
}

"""
if old_limb not in d:
    raise SystemExit('limb function not found')
d = d.replace(old_limb, '', 1)

old_squash = """  let scale = (TARGET_H * f.build) / ih;
  // Replay feel: punch/kick stretch each time moveProgress restarts
  let squashX = 1;
  let localSquashY = squashY;
  if (f.state === 'attack') {
    const mp = f.moveProgress || 0;
    const punch = mp < 0.45 ? Math.pow(mp / 0.45, 0.7) : 1 - Math.pow((mp - 0.45) / 0.55, 1.4);
    const e = Math.max(0, Math.min(1, punch));
    squashX = 1 + 0.12 * e;
    localSquashY = squashY * (1 - 0.08 * e);
    scale *= 1 + 0.04 * e;
  }
  const dw = iw * scale * squashX;
  const dh = ih * scale;
  const facing = f.facing >= 0 ? 1 : -1;
  squashY = localSquashY;
"""
new_squash = """  let scale = (TARGET_H * f.build) / ih;
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
"""
if old_squash not in d:
    raise SystemExit('squash block not found')
d = d.replace(old_squash, new_squash, 1)

if 'ctx.scale(facing, squashY);' not in d:
    raise SystemExit('scale call not found')
# Only replace the fighter body scale call — first occurrence after our edit context
d = d.replace('ctx.scale(facing, squashY);', 'ctx.scale(facing, scaleSquashY);', 1)

draw.write_text(d)
print('draw.ts patched')
print('done')
