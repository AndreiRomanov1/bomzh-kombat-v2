import hashlib
from pathlib import Path
for name in ['enemy-idle.webp','enemy-walk.webp','enemy-punch.webp','enemy-walk0.webp','enemy-kick.webp','enemy-block.webp','enemy-hurt.webp','enemy-special.webp','enemy-walk1.webp','enemy-walk2.webp','enemy-walk3.webp']:
    a=Path('/workspace/bomzh-kombat-v2/src/assets/combat')/name
    b=Path('/workspace/bomzh-kombat-v2/public/images')/name
    ha=hashlib.md5(a.read_bytes()).hexdigest()
    hb=hashlib.md5(b.read_bytes()).hexdigest()
    print(name, 'same' if ha==hb else 'DIFF', a.stat().st_mtime, b.stat().st_mtime)
