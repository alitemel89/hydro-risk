"""Offline data preparation, not part of the application build.
Fetch only the two public compressed parts needed for the bounded Istanbul window.
Original country data is never shipped with the Site; outputs are ODbL derivatives.
Grid and 4-bit encoding metadata: SUEN-HAB public bundle/decoder, retrieved 2026-10-18.
"""
import urllib.request
from pathlib import Path
import numpy as np,gzip,hashlib,json,math
p=Path(__file__).resolve().parent/'raw';p.mkdir(exist_ok=True)
ox=23.402083333;oy=43.347083333;dx=.0008333333333430174;dy=-.0008333333333146351;W=34421
r0=math.floor((oy-41.8)/-dy);r1=math.ceil((oy-40.6)/-dy);c0=math.floor((27.4-ox)/dx);c1=math.ceil((30.6-ox)/dx)
window=np.zeros((r1-r0,c1-c0),dtype=np.uint8)
start=0;hashes={}
for name in ['part1.bin.gz','part2.bin.gz']:
 q=p/name
 if not q.exists():
  index=name[4]
  url='https://hab.suen.gov.tr/data/tr_flow_direction_packed_part_'+index+'.bin.gz'
  with urllib.request.urlopen(url,timeout=60) as response,q.open('wb') as target:
   while True:
    block=response.read(256*1024)
    if not block:break
    target.write(block)

for name in ['part1.bin.gz','part2.bin.gz']:
 raw=(p/name).read_bytes();packed=np.frombuffer(gzip.decompress(raw),dtype=np.uint8);arr=np.empty(packed.size*2,dtype=np.uint8);arr[::2]=packed>>4;arr[1::2]=packed&15
 for row in range(r0,r1):
  a=row*W+c0;b=row*W+c1
  a2=max(a,start);b2=min(b,start+arr.size)
  if b2>a2:window[row-r0,a2-a:b2-a]=arr[a2-start:b2-start]
 start+=arr.size;hashes[name]=hashlib.sha256(raw).hexdigest()
np.savez_compressed(p/'istanbul-flow-window.npz',flow=window,originX=ox+c0*dx,originY=oy+r0*dy,dx=dx,dy=dy)
(p/'flow-window-metadata.json').write_text(json.dumps({'rows':window.shape[0],'cols':window.shape[1],'originX':ox+c0*dx,'originY':oy+r0*dy,'dx':dx,'dy':dy,'hashes':hashes,'directionCodes':{'1':'E','2':'SE','3':'S','4':'SW','5':'W','6':'NW','7':'N','8':'NE'},'source':'https://hab.suen.gov.tr/','dataSource':'MERIT Hydro v1.0.1, Yamazaki et al. 2019','license':'ODbL-1.0'},indent=2))
print('window',window.shape,'zeros',np.mean(window==0),'unique',np.unique(window),'size',(p/'istanbul-flow-window.npz').stat().st_size)
