from pathlib import Path
import json,hashlib
from shapely.geometry import shape,mapping
from shapely.validation import make_valid,explain_validity
from pyproj import Geod
ROOT=Path(__file__).resolve().parent;PROJECT=ROOT.parent.parent
source=json.loads((ROOT/'raw/water-supply-istanbul.geojson').read_text());geod=Geod(ellps='WGS84')
NAMES={1:('istanbul-terkos','Terkos Gölü'),2:('istanbul-sazlidere','Sazlıdere Barajı'),3:('istanbul-alibey-baraji','Alibeyköy Barajı'),4:('istanbul-buyukcekmece','Büyükçekmece Gölü'),6:('istanbul-elmali','Elmalı-II Barajı'),8:('istanbul-darlik','Darlık Barajı'),9:('istanbul-omerli','Ömerli Barajı')}
features=[];checks=[]
url='https://cbs1.tarimorman.gov.tr/server/rest/services/SYGM/icme_suyu_havza_sinirlari/MapServer/0'
for f in source['features']:
 raw=f['properties'];key=raw['ID']
 if key not in NAMES:continue
 id,name=NAMES[key];original=shape(f['geometry']);repairReason=None if original.is_valid else explain_validity(original);g=original if original.is_valid else make_valid(original);assert g.is_valid and not g.is_empty and g.geom_type in ['Polygon','MultiPolygon']
 a=abs(geod.geometry_area_perimeter(g)[0])/1e6;s=g.simplify(.00005,preserve_topology=True);b=abs(geod.geometry_area_perimeter(s)[0])/1e6;assert abs(b/a-1)<.002
 props={'id':id,'name':name,'regionId':'istanbul','regionName':'İstanbul','basinType':'water_supply','boundaryStatus':'Bakanlık içme suyu havza katmanı','boundarySource':'Tarım ve Orman Bakanlığı / SYGM · İçme Suyu Havza Sınırları','sourceUrl':url,'geometryRepair':repairReason,'sourceObjectId':raw['OBJECTID'],'sourceName':raw['ADI'],'retrievedAt':'2026-10-18','referenceAreaKm2':round(b,5),'generalizationDegrees':.00005,'uncertainties':['İçme suyu havzası; tüm aşağı dere havzasını veya taşkın yayılımını temsil etmez','Baraj işletmesi, su çekimi ve rezervuar depolaması hesaplanmaz','Yerel kalibrasyon yapılmadı'],'notes':'Bu alan için yağış–akış oluşumu hesaplanır; barajdan salınan debi veya aşağı kesim taşkını tahmin edilmez'}
 features.append({'type':'Feature','properties':props,'geometry':mapping(s)})
 checks.append({'id':id,'valid':s.is_valid,'referenceAreaKm2':b,'repairReason':repairReason,'sourceAreaKm2':a,'areaChangeFraction':b/a-1,'bounds':list(s.bounds)})
 print(name,round(b,2),s.geom_type,flush=True)
assert len(features)==7
features.sort(key=lambda f:f['properties']['name'])
derived=json.loads((ROOT/'istanbul-derived-basins.geojson').read_text())
catalog={'type':'FeatureCollection','name':'İstanbul havzaları','source':'Kaynak ve sınır niteliği her havzanın properties alanında ayrı belirtilir','retrievedAt':'2026-10-18','features':derived['features']+features}
(ROOT/'istanbul-basins.geojson').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')))
(PROJECT/'worker/istanbul-basins.mjs').write_text('// Derived drainage data: MERIT Hydro © Yamazaki et al. 2019; ODbL-1.0.\n// Ministry water-supply boundaries retain their separate source attribution.\nexport const ISTANBUL_BASINS='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';\n')
(ROOT/'source-validation.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2))
