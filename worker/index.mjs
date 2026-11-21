import {analysisApi} from './analysis.mjs';
import {HISTORICAL_STUDY} from './history-data.mjs';
import {monitoringApi} from './monitoring.mjs';
import {validatePolygon} from './geometry.mjs';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
function db(env){if(!env.DB)throw new Error('Kayıt hizmeti hazır değil');return env.DB;}
export async function handleApi(request,env) {
 const path=new URL(request.url).pathname;
 if(env.PUBLIC_DEMO==='true'&&(path==='/api/areas'||path==='/api/hydrology'||path.startsWith('/api/monitor')))return reply({message:'Bu demo ortak kayıt veya izleme verilerine erişim sağlamaz.'},403);
 if(path==='/api/history')return request.method==='GET'?reply(HISTORICAL_STUDY):reply({message:'GET gerekli'},405);
 if(['/api/analysis','/api/basins'].includes(path))return analysisApi(request,env);
 try{
  if(['/api/monitors','/api/monitors/configure','/api/monitoring/status','/api/monitoring/inputs','/api/monitoring/ingest','/api/monitoring/refresh','/api/hydrology'].includes(path))return monitoringApi(request,env);
  if(path==='/api/rivers')return riversApi(request);
  if(path==='/api/dem')return demApi(request);
  if(path==='/api/corine')return corineApi(request);
  if(path==='/api/health')return reply({status:'ok',analysisReady:true,historyReady:true,hydrologyReady:true,warningStatus:'screening_only',datasets:{corine:{configured:true,year:2018,status:"external_service"},dem:{configured:true,dataset:"srtm90m",resolutionM:90},rivers:{configured:true,source:"OpenStreetMap / Overpass"}}});
  if(path!=='/api/areas')return reply({message:'Bulunamadı'},404);
  if(request.method==='GET'){
   const result=await db(env).prepare('SELECT id,name,geometry,area_km2 AS areaKm2,created_at AS createdAt FROM areas ORDER BY created_at DESC LIMIT 100').all();
   return reply(result.results.map(row=>({...row,geometry:JSON.parse(row.geometry)})));
  }
  if(request.method!=='POST')return reply({message:'Desteklenmeyen işlem'},405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin)return reply({message:'İstek kaynağı doğrulanamadı'},403);
  if(!request.headers.get('Content-Type')?.includes('application/json'))return reply({message:'JSON gerekli'},415);
  const text=await request.text();
  if(text.length>80000)return reply({message:'Alan çok büyük'},413);
  let input;
  try{input=validatePolygon(JSON.parse(text));}catch(error){return reply({message:error instanceof SyntaxError?'JSON geçersiz':error.message},400);}
  const area={...input,id:crypto.randomUUID(),createdAt:new Date().toISOString()};
  await db(env).prepare('INSERT INTO areas(id,name,geometry,area_km2,created_at) VALUES(?,?,?,?,?)').bind(area.id,area.name,JSON.stringify(area.geometry),area.areaKm2,area.createdAt).run();
  return reply(area,201);
 }catch(error){console.error('Hydro Risk kayıt hatası',error);return reply({message:'Kayıt hizmetine şu an erişilemiyor. Seçimin korunuyor; tekrar deneyebilirsin.'},503);}
}

const CORINE_SERVICE='https://image.discomap.eea.europa.eu/arcgis/rest/services/Corine/CLC2018_WM/MapServer';
async function corineApi(request){
 if(request.method!=='POST')return reply({message:'POST gerekli'},405);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return reply({message:'İstek kaynağı doğrulanamadı'},403);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return reply({message:'JSON gerekli'},415);
 const raw=await request.text();if(raw.length>80000)return reply({message:'Alan çok büyük'},413);
 let area;try{area=validatePolygon({...JSON.parse(raw),name:'CORINE alanı'});}catch(e){return reply({message:e.message},400);}
 const params=new URLSearchParams({f:'json',where:'1=1',geometry:JSON.stringify({rings:area.geometry.coordinates,spatialReference:{wkid:4326}}),geometryType:'esriGeometryPolygon',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'Code_18',returnGeometry:'false',returnDistinctValues:'true'});
 try{
 const response=await fetch(CORINE_SERVICE+'/0/query',{method:'POST',body:params,signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('upstream');const data=await response.json();if(data.error||!Array.isArray(data.features)||data.exceededTransferLimit)throw new Error('upstream');
 const codes=[...new Set(data.features.map(f=>String(f.attributes?.Code_18)).filter(c=>/^\d{3}$/.test(c)))].sort();
 return reply({year:2018,source:'Copernicus / EEA',sourceUrl:CORINE_SERVICE,queriedAt:new Date().toISOString(),codes,status:codes.length?'available':'no_data',method:'polygon_intersection',riskScore:null});
 }catch{return reply({message:'CORINE servisine şu an erişilemiyor. Daha sonra tekrar dene; örnek veri gösterilmiyor.'},502);}
}

function insideDem(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function demSamples(geometry){const ring=geometry.coordinates[0];const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);const minX=Math.min(...xs),minY=Math.min(...ys),dx=Math.max(...xs)-minX,dy=Math.max(...ys)-minY;const points=[];for(let y=0;y<3;y++)for(let x=0;x<3;x++){const p=[minX+(x+.5)*dx/3,minY+(y+.5)*dy/3];if(insideDem(p,ring))points.push(p);}return points;}
export function demSummary(points,results){
 const samples=points.map((p,i)=>{const values=results.slice(i*5,i*5+5).map(r=>r.elevation);const elevation=Number.isFinite(values[0])?values[0]:null;const valid=values.every(Number.isFinite);const slopePercent=valid?100*Math.hypot((values[2]-values[1])/180,(values[4]-values[3])/180):null;return {lng:p[0],lat:p[1],elevation,slopePercent,slopeDegrees:slopePercent===null?null:Math.atan(slopePercent/100)*180/Math.PI};});
 const elevations=samples.map(p=>p.elevation).filter(Number.isFinite),slopes=samples.map(p=>p.slopePercent).filter(Number.isFinite);return {samples,minElevation:elevations.length?Math.min(...elevations):null,maxElevation:elevations.length?Math.max(...elevations):null,meanElevation:elevations.length?elevations.reduce((a,b)=>a+b,0)/elevations.length:null,meanSlopePercent:slopes.length?slopes.reduce((a,b)=>a+b,0)/slopes.length:null,validSamples:elevations.length,totalSamples:points.length,status:elevations.length?(elevations.length===points.length?'available':'partial'):'no_data'};
}
async function demApi(request){
 if(request.method!=='POST')return reply({message:'POST gerekli'},405);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return reply({message:'İstek kaynağı doğrulanamadı'},403);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return reply({message:'JSON gerekli'},415);
 const raw=await request.text();if(raw.length>80000)return reply({message:'Alan çok büyük'},413);
 let area;try{area=validatePolygon({...JSON.parse(raw),name:'DEM alanı'});}catch(e){return reply({message:e.message},400);}
 const points=demSamples(area.geometry);if(!points.length)return reply({message:'Bu dar veya düzensiz alan örneklenemedi. Alanı genişlet veya daha düzenli seç.'},422);
 if(points.some(p=>p[1]<-60||p[1]>60))return reply({message:'SRTM bu enlemde kapsama sağlamıyor (60°G–60°K).'},422);
 const locations=points.flatMap(([lng,lat])=>{const dy=90/111195,dx=90/(111195*Math.cos(lat*Math.PI/180));return [[lat,lng],[lat,lng-dx],[lat,lng+dx],[lat-dy,lng],[lat+dy,lng]];}).map(p=>p.join(',')).join('|');
 try{const url=new URL('https://api.opentopodata.org/v1/srtm90m');url.searchParams.set('locations',locations);url.searchParams.set('interpolation','bilinear');const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('upstream');const data=await response.json();if(data.status!=='OK'||data.results?.length!==points.length*5)throw new Error('upstream');return reply({...demSummary(points,data.results),dataset:'SRTM 90 m',resolutionM:90,source:'Open Topo Data / SRTM',queriedAt:new Date().toISOString(),method:'3x3_interior_samples_central_difference_90m',riskScore:null});}catch{return reply({message:'DEM servisine şu an erişilemiyor veya kota doldu. Biraz sonra tekrar dene.'},502);}
}

const RIVER_PROVIDERS=['https://overpass.private.coffee/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
async function riversApi(request){
 if(request.method!=='POST')return reply({message:'POST gerekli'},405);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return reply({message:'İstek kaynağı doğrulanamadı'},403);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return reply({message:'JSON gerekli'},415);
 const raw=await request.text();if(raw.length>80000)return reply({message:'Alan çok büyük'},413);
 let area;try{area=validatePolygon({...JSON.parse(raw),name:'Akarsu alanı'});}catch(e){return reply({message:e.message},400);}
 const ring=area.geometry.coordinates[0],xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);const lat=(Math.min(...ys)+Math.max(...ys))/2,dy=1000/111195,dx=dy/Math.cos(lat*Math.PI/180);const bbox=[Math.max(-85,Math.min(...ys)-dy),Math.max(-180,Math.min(...xs)-dx),Math.min(85,Math.max(...ys)+dy),Math.min(180,Math.max(...xs)+dx)].map(v=>Number(v.toFixed(5)));
 if(bbox[2]-bbox[0]>1||bbox[3]-bbox[1]>1)return reply({message:'Akarsu sorgusu için daha kompakt bir alan seç (en fazla 1° çevreleyen kutu).'},422);
 const cache=typeof caches!=='undefined'?caches.default:null;
 const key=new Request(new URL('/__river_cache_v2?bbox='+bbox.join(','),request.url).toString());
 if(cache)try{const hit=await cache.match(key);if(hit)return reply({...await hit.json(),cacheHit:true});}catch{/* Cache availability never blocks the layer. */}
 const query='[out:json][timeout:6][maxsize:16777216];way[waterway~"^(river|stream|canal|drain)$"]('+bbox.join(',')+');out geom;';
 for(const provider of RIVER_PROVIDERS){
  try{
   const response=await fetch(provider,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'HydroRisk/1.0 (+https://hydro-risk.aylintemel-de.chatgpt.site)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(8000)});
   if(!response.ok)continue;
   const data=await response.json();if(data.remark||!Array.isArray(data.elements)||data.elements.length>10000)continue;
   const features=data.elements.filter(e=>e.type==='way'&&e.geometry?.length>1&&e.geometry.every(p=>Number.isFinite(p.lon)&&Number.isFinite(p.lat))).map(e=>({type:'Feature',id:e.id,properties:{name:e.tags?.name||'İsimsiz su yolu',waterway:e.tags?.waterway},geometry:{type:'LineString',coordinates:e.geometry.map(p=>[p.lon,p.lat])}}));
   const result={type:'FeatureCollection',features,bbox,queriedAt:new Date().toISOString(),source:'OpenStreetMap / Overpass',provider,license:'ODbL',method:'selection_bbox_plus_1000m',riskContribution:false,cacheHit:false};
   if(cache)try{await cache.put(key,new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=600'}}));}catch{/* Valid live data remains usable without caching. */}
   return reply(result);
  }catch{/* One bounded attempt per provider; never substitute example geometry. */}
 }
 // The main OSM API is a bounded last resort for a small selected footprint,
 // not an extractor for large polygons or a substitute for regional Overpass data.
 const localBbox=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)].map(v=>Number(v.toFixed(6)));
 const localAreaKm2=(localBbox[2]-localBbox[0])*(localBbox[3]-localBbox[1])*111.195**2*Math.cos(lat*Math.PI/180);
 if(localAreaKm2<=2){
  try{
   const provider='https://www.openstreetmap.org/api/0.6/map.json?bbox='+localBbox.join(',');
   const response=await fetch(provider,{headers:{'User-Agent':'HydroRisk/1.0 (+https://hydro-risk.aylintemel-de.chatgpt.site)'},signal:AbortSignal.timeout(8000)});
   if(response.ok&&Number(response.headers.get('Content-Length')||0)<=6000000){
    const text=await response.text();if(text.length>6000000)throw new Error('Bounded OSM response exceeded');
    const data=JSON.parse(text);if(!Array.isArray(data.elements)||data.remark)throw new Error('Incomplete OSM map response');
    const nodes=new Map(data.elements.filter(e=>e.type==='node'&&Number.isFinite(e.lat)&&Number.isFinite(e.lon)).map(e=>[e.id,[e.lon,e.lat]]));
    const ways=data.elements.filter(e=>e.type==='way'&&['river','stream','canal','drain'].includes(e.tags?.waterway));
    if(ways.some(e=>!Array.isArray(e.nodes)||e.nodes.length<2||e.nodes.some(id=>!nodes.has(id))))throw new Error('Incomplete waterway nodes');
    const features=ways.map(e=>({type:'Feature',id:e.id,properties:{name:e.tags?.name||'İsimsiz su yolu',waterway:e.tags.waterway},geometry:{type:'LineString',coordinates:e.nodes.map(id=>nodes.get(id))}}));
    const result={type:'FeatureCollection',features,bbox:[localBbox[1],localBbox[0],localBbox[3],localBbox[2]],queriedAt:new Date().toISOString(),source:'OpenStreetMap API',provider,license:'ODbL',method:'selection_bbox_no_buffer',coverageNote:'Yedek kaynak: yalnızca seçili alan; 1 km çevre tamponu dahil değil.',riskContribution:false,cacheHit:false};
    if(cache)try{await cache.put(key,new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=600'}}));}catch{}
    return reply(result);
   }
  }catch{/* Preserve the recoverable error if even this bounded source fails. */}
 }
 return reply({message:'Akarsu veri servisleri şu an yanıt vermiyor. Biraz sonra Tekrar dene düğmesini kullanabilirsin.',code:'RIVERS_UNAVAILABLE',retryable:true},503);
}
