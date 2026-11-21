"""Create a bounded, acyclic D8 accumulation index for offline basin preparation."""
import numpy as np,time
from pathlib import Path
from collections import deque
p=Path(__file__).resolve().parent/'raw';z=np.load(p/'istanbul-flow-window.npz');flow=z['flow'];H,W=flow.shape;N=H*W;flat=flow.ravel();idx=np.arange(N,dtype=np.int32);down=np.full(N,-1,dtype=np.int32)
rows=idx//W;cols=idx%W
for code,(dr,dc) in enumerate([(0,1),(1,1),(1,0),(1,-1),(0,-1),(-1,-1),(-1,0),(-1,1)],1):
 mask=(flat==code)&(rows+dr>=0)&(rows+dr<H)&(cols+dc>=0)&(cols+dc<W);down[mask]=idx[mask]+dr*W+dc
indegree=np.bincount(down[down>=0],minlength=N).astype(np.int8);acc=np.ones(N,dtype=np.int32);queue=deque(np.where(indegree==0)[0]);count=0;at=time.monotonic()
while queue:
 i=queue.popleft();j=down[i];count+=1
 if j>=0:
  acc[j]+=acc[i];indegree[j]-=1
  if indegree[j]==0:queue.append(j)
assert count==N, 'Flow graph contains a cycle'
np.savez_compressed(p/'istanbul-flow-index.npz',down=down.reshape(H,W),acc=acc.reshape(H,W),flow=flow,originX=z['originX'],originY=z['originY'],dx=z['dx'],dy=z['dy'])
print('processed',count,'of',N,'cycle cells',np.sum(indegree>0),'seconds',round(time.monotonic()-at,2),flush=True)
