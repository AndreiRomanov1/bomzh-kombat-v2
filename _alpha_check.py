from PIL import Image
for n in ['player-special.webp','player-hurt.webp','enemy-special.webp','enemy-hurt.webp','player-idle.webp']:
  im=Image.open('/workspace/bomzh-kombat-v2/public/images/'+n)
  a=im.split()[3]
  extrema=a.getextrema()
  nz=sum(1 for p in a.getdata() if p==0)
  print(n, im.size, 'alpha_range', extrema, 'transparent_px', nz)
