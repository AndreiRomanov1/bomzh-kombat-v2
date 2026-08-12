from PIL import Image
import os
pairs=[("/workspace/bomzh-kombat-v2/public/images/player-idle.webp","player"),("/workspace/bomzh-kombat-v2/public/images/enemy-idle.webp","enemy")]
for p,n in pairs:
 im=Image.open(p); print(n, im.size, im.mode)
