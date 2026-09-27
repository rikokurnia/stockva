"""Read alpha bounds for sprite framing; never modify source artwork."""
import json
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[1]
frames={}
for vehicle,split in [('electric_bus',850),('construction_truck',810),('maintenance_van',810)]:
 frames[vehicle]={}
 for direction in ['upper_left','upper_right','lower_left','lower_right','right','down','left','up']:
  filename=f'{direction}.png' if '_' in direction else 'turns.png'
  src=f'/assets/sprites/vehicles/{vehicle}/{filename}'
  im=Image.open(root/'public'/src.lstrip('/'))
  w,h=im.size
  rect=(0,0,w,h)
  if filename=='turns.png':
   rect={'right':(0,0,split,h//2),'down':(split,0,w,h//2),'left':(0,h//2,split,h),'up':(split,h//2,w,h)}[direction]
  alpha=im.getchannel('A').crop(rect).point(lambda p:255 if p>24 else 0)
  x,y,r,b=alpha.getbbox();x+=rect[0];r+=rect[0];y+=rect[1];b+=rect[1]
  frames[vehicle][direction]={'src':src,'viewBox':f'{x} {y} {r-x} {b-y}','width':w,'height':h}
(root/'lib/vehicle-frames.json').write_text(json.dumps(frames,indent=2)+'\n')
