"""Reproducible D8 upstream delineation; independent code, not copied SUEN application code.
Input: the bounded MERIT Hydro direction window and index prepared from public SUEN-HAB data.
Outputs are a derived database under ODbL-1.0, not surveyed/official local catchment boundaries.
"""
from pathlib import Path
import json,hashlib
import numpy as np
from rasterio.features import shapes
from rasterio.transform import Affine
from shapely.geometry import shape,mapping,Point
from shapely.ops import unary_union
from pyproj import Geod
ROOT=Path(__file__).resolve().parent
z=np.load(ROOT/'raw/istanbul-flow-index.npz');flow=z['flow'];down=z['down'].ravel();acc=z['acc'];H,W=flow.shape
ox=float(z['originX']);oy=float(z['originY']);dx=float(z['dx']);dy=float(z['dy']);geod=Geod(ellps='WGS84')
# Kağıthane and Alibey outlets are the two separate branches immediately upstream
# of the first MERIT confluence. Ayamama uses the last land cell of its MERIT path.
OUTLETS=[('istanbul-ayamama','Ayamama Deresi',28.848333333,40.9725),('istanbul-kagithane','Kağıthane Deresi',28.9475,41.0625),('istanbul-alibey-deresi','Alibey Deresi · Haliç kolu',28.945833333,41.0625)]
features=[];checks=[]
for id,name,x,y in OUTLETS:
 row=int((y-oy)/dy);col=int((x-ox)/dx);out=row*W+col;visited=np.zeros((H,W),dtype=np.uint8);visited[row,col]=1;stack=[out];count=0
 while stack:
  i=stack.pop();count+=1;r=i//W;c=i%W
  for dr in [-1,0,1]:
   for dc in [-1,0,1]:
    if dr==dc==0:continue
    rr=r+dr;cc=c+dc
    if 0<=rr<H and 0<=cc<W and not visited[rr,cc] and down[rr*W+cc]==i:visited[rr,cc]=1;stack.append(rr*W+cc)
 assert count==int(acc[row,col]),(name,count,int(acc[row,col]))
 assert not (visited[0].any() or visited[-1].any() or visited[:,0].any() or visited[:,-1].any()),'Upstream domain clipped'
 geometries=[shape(g) for g,v in shapes(visited,mask=visited.astype(bool),transform=Affine(dx,0,ox,0,dy,oy),connectivity=4) if v==1]
 geom=unary_union(geometries);assert geom.is_valid and not geom.is_empty
 originalArea=abs(geod.geometry_area_perimeter(geom)[0])/1e6
 simplified=geom.simplify(.00008,preserve_topology=True);area=abs(geod.geometry_area_perimeter(simplified)[0])/1e6
 assert abs(area/originalArea-1)<.001
 outlet=[ox+(col+.5)*dx,oy+(row+.5)*dy];assert simplified.covers(Point(outlet))
 props={'id':id,'name':name,'regionId':'istanbul','regionName':'İstanbul','basinType':'derived_drainage','boundaryStatus':'MERIT Hydro’dan türetilen drenaj sınırı · resmî değil','boundarySource':'MERIT Hydro v1.0.1 / SUEN-HAB akış yönü verisi; Hydro Risk D8 yukarı-akış çıkarımı','sourceUrl':'https://hab.suen.gov.tr/','dataSourceUrl':'https://global-hydrodynamics.github.io/MERIT_Hydro/','license':'ODbL-1.0','licenseUrl':'https://opendatacommons.org/licenses/odbl/1-0/','citation':'Yamazaki et al. (2019), MERIT Hydro, Water Resources Research, doi:10.1029/2019WR024873','retrievedAt':'2026-10-18','referenceAreaKm2':round(area,5),'rasterAreaKm2':round(originalArea,5),'cellCount':count,'resolutionArcSeconds':3,'resolutionNote':'3 yay-saniye (~90 m); yeraltı drenajı ve güncel kanal düzenlemeleri çözülmez','outlet':outlet,'outletSelection':'MERIT ağında Ayamama son kara hücresi; Kağıthane/Alibey ilk birleşim öncesi ayrı kollar','generalizationDegrees':.00008,'uncertainties':['Küresel topoğrafik akış ağı; yerel ölçümlerle doğrulanmadı','Kapalı kanal ve yağmursuyu şebekesi modele dahil değil','Alibey kolunda baraj işletmesi ve depolama etkisi modellenmiyor'],'notes':'Alibey baraj su toplama alanıyla örtüşür; havza hacimleri toplanmamalı' if 'alibey' in id else 'Seçilen çıkış noktasına su taşıyan topoğrafik alan; taşkın yayılım alanı değildir'}
 features.append({'type':'Feature','properties':props,'geometry':mapping(simplified)})
 checks.append({'id':id,'cellCount':count,'areaKm2':area,'areaChangeFraction':area/originalArea-1,'geometryValid':True,'clippedAtDomain':False,'outletInBoundary':True,'bounds':list(simplified.bounds)})
 print(name,round(area,2),'km2',count,'cells',simplified.geom_type,flush=True)
collection={'type':'FeatureCollection','name':'İstanbul yerel drenaj havzaları · MERIT Hydro türetimi','license':'ODbL-1.0','licenseUrl':'https://opendatacommons.org/licenses/odbl/1-0/','attribution':'MERIT Hydro © Yamazaki et al. 2019; akış yönü dağıtımı SUEN-HAB; D8 türetim Hydro Risk','sourceUrl':'https://hab.suen.gov.tr/','retrievedAt':'2026-10-18','features':features}
(ROOT/'istanbul-derived-basins.geojson').write_text(json.dumps(collection,ensure_ascii=False,separators=(',',':')))
(ROOT/'derived-validation.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
