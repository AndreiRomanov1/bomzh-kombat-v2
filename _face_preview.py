from PIL import Image
from pathlib import Path
out = Path('/workspace/bomzh-kombat-v2/crop_preview')
for name in ['player-idle.webp','enemy-idle.webp','player-walk0.webp','enemy-walk0.webp']:
    src = Path('/workspace/bomzh-kombat-v2/src/assets/combat')/name
    im = Image.open(src).convert('RGBA')
    bg = Image.new('RGBA', im.size, (180,180,180,255))
    bg.alpha_composite(im)
    dest = out / f'live-{name}.png'
    bg.convert('RGB').save(dest)
    print('wrote', dest, im.size)
