from PIL import Image
from pathlib import Path

roots = [
    Path('/workspace/bomzh-kombat-v2/src/assets/combat'),
    Path('/workspace/bomzh-kombat-v2/public/images'),
]
for root in roots:
    for p in sorted(root.glob('enemy-*.webp')):
        if 'portrait' in p.name:
            continue
        im = Image.open(p).convert('RGBA')
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        im.save(p, 'WEBP', quality=92, method=6)
        print('flipped', p)
print('done flip')
