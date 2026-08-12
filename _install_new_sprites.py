#!/usr/bin/env python3
from PIL import Image
import os

OUT_PUBLIC = "/workspace/bomzh-kombat-v2/public/images"
OUT_COMBAT = "/workspace/bomzh-kombat-v2/src/assets/combat"
TARGET_H = 360
PAD = 10
WEBP_Q = 90

JOBS = [
    ("/home/box/sand-data/agents/9d4d5d30-c49e-4912-9bfb-23d9d675684f/assets/b9bd844be0fdf2adf23b8d1bc1d13f66c6df1ef0ae7a725c39f0835c976cc5ea.png", "player-special.webp", 222),
    ("/home/box/sand-data/agents/9d4d5d30-c49e-4912-9bfb-23d9d675684f/assets/f38770551e6cfa1bc908d5316ca80adca641ed2332630d9a82687d7027ba2161.png", "player-hurt.webp", 222),
    ("/home/box/sand-data/agents/9d4d5d30-c49e-4912-9bfb-23d9d675684f/assets/ed5c7e8db2d650a83f3d3711a2da923952a64cd422ec7fd93489df9616b0a47e.png", "enemy-special.webp", 163),
    ("/home/box/sand-data/agents/9d4d5d30-c49e-4912-9bfb-23d9d675684f/assets/1a70f4f39aa7207a98d880d36b76bfd0499704ac15856e404a2e328bd34b7c7c.png", "enemy-hurt.webp", 163),
]

def knock_black(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # near-black background -> transparent
            if r < 28 and g < 28 and b < 28:
                px[x, y] = (0, 0, 0, 0)
            elif r < 45 and g < 45 and b < 45:
                # soft fringe
                lum = (r + g + b) / 3
                na = int(max(0, min(255, (lum - 10) * 7)))
                px[x, y] = (r, g, b, na)
    return im

def bbox_alpha(im: Image.Image):
    a = im.split()[3]
    return a.getbbox()

def fit(im: Image.Image, target_w: int | None, target_h: int) -> Image.Image:
    im = knock_black(im)
    box = bbox_alpha(im)
    if not box:
        raise SystemExit("empty after key")
    im = im.crop(box)
    w, h = im.size
    scale = (target_h - 2 * PAD) / h
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    # canvas width: use max(target_w hint, content+pad) to avoid clipping weapons
    cw = max(target_w or 0, nw + 2 * PAD)
    ch = target_h
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    x = (cw - nw) // 2
    y = ch - nh - PAD
    canvas.paste(im, (x, y), im)
    return canvas

for src, name, tw in JOBS:
    out = fit(Image.open(src), tw, TARGET_H)
    for d in (OUT_PUBLIC, OUT_COMBAT):
        path = os.path.join(d, name)
        out.save(path, "WEBP", quality=WEBP_Q, method=6)
        print("wrote", path, out.size)
print("done")
