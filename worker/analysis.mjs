import {AEGEAN_BASINS} from './basins.mjs';
import {ISTANBUL_BASINS} from './istanbul-basins.mjs';
export const ANALYSIS_BASINS={type:'FeatureCollection',source:'Havza bazında kaynak ve sınır niteliği properties alanında belirtilir',features:[...ISTANBUL_BASINS.features,...AEGEAN_BASINS.features.map(f=>({...f,properties:{...f.properties,regionId:'ege',regionName:'Ege',basinType:'major_basin',boundaryStatus:'Bakanlık ana havza sınırı',boundarySource:AEGEAN_BASINS.source,sourceUrl:AEGEAN_BASINS.sourceUrl}}))]};
import {analysisRegionForPoint,checkAnalysisRegion} from './regions.mjs';
import {validatePolygon} from './geometry.mjs';
import {hydrologySeries,forecastHours,DEFAULT_HYDRO} from './hydrology.mjs';

export const LAND_MODELS={
 '111':{label:'Sürekli kent dokusu',cn:[89,92,94,95],impervious:.8},
 '112':{label:'Kesintili kent dokusu',cn:[77,85,90,92],impervious:.65},
 '121':{label:'Sanayi / ticaret',cn:[81,88,91,93],impervious:.72},
 '122':{label:'Ulaşım alanları',cn:[98,98,98,98],impervious:.95},
 '123':{label:'Liman',cn:[89,92,94,95],impervious:.8},
 '124':{label:'Havaalanı',cn:[61,75,83,87],impervious:.3},
 '131':{label:'Maden / çıplak zemin',cn:[77,86,91,94],impervious:0},
 '132':{label:'Atık alanı',cn:[77,86,91,94],impervious:.1},
 '133':{label:'İnşaat alanı',cn:[77,86,91,94],impervious:.1},
 '141':{label:'Kentsel yeşil alan',cn:[39,61,74,80],impervious:0},
 '142':{label:'Spor / dinlenme',cn:[49,69,79,84],impervious:.1},
 '211':{label:'Sulanmayan ekilebilir alan',cn:[67,78,85,89],impervious:0},
 '212':{label:'Sulanan tarım',cn:[67,78,85,89],impervious:0},
 '213':{label:'Pirinç tarlası',cn:[67,78,85,89],impervious:0},
 '221':{label:'Üzüm bağı',cn:[43,65,76,82],impervious:0},
 '222':{label:'Meyve bahçesi',cn:[43,65,76,82],impervious:0},
 '223':{label:'Zeytinlik',cn:[43,65,76,82],impervious:0},
 '231':{label:'Mera',cn:[39,61,74,80],impervious:0},
 '241':{label:'Yıllık / kalıcı ürünler',cn:[67,78,85,89],impervious:0},
 '242':{label:'Karma tarım',cn:[67,78,85,89],impervious:0},
 '243':{label:'Doğal örtülü tarım',cn:[43,65,76,82],impervious:0},
 '244':{label:'Tarımsal ormancılık',cn:[43,65,76,82],impervious:0},
 '311':{label:'Geniş yapraklı orman',cn:[30,55,70,77],impervious:0},
 '312':{label:'İğne yapraklı orman',cn:[30,55,70,77],impervious:0},
 '313':{label:'Karışık orman',cn:[30,55,70,77],impervious:0},
 '321':{label:'Doğal çayır',cn:[39,61,74,80],impervious:0},
 '322':{label:'Fundalık',cn:[35,56,70,77],impervious:0},
 '323':{label:'Sert yapraklı örtü',cn:[35,56,70,77],impervious:0},
 '324':{label:'Geçiş orman / çalılık',cn:[35,56,70,77],impervious:0},
 '331':{label:'Kum / kumsal',cn:[77,86,91,94],impervious:0},
 '332':{label:'Çıplak kaya',cn:[96,96,96,96],impervious:.9},
 '333':{label:'Seyrek bitki örtüsü',cn:[49,69,79,84],impervious:0},
 '334':{label:'Yanmış alan',cn:[77,86,91,94],impervious:0}
};
export const SOIL_SCENARIOS={A:{label:'A · geçirgen',ks:30,suction:60,percolationRate:5},B:{label:'B · orta geçirgen',ks:10,suction:110,percolationRate:2},C:{label:'C · az geçirgen',ks:3,suction:180,percolationRate:.8},D:{label:'D · çok az geçirgen',ks:.8,suction:250,percolationRate:.2}};
const analysisJson=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function analysisRingContains(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function analysisContains(point,geometry){const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;return polygons.some(rings=>analysisRingContains(point,rings[0])&&!rings.slice(1).some(r=>analysisRingContains(point,r)));}
function analysisRings(geometry){return geometry.type==='Polygon'?geometry.coordinates:geometry.coordinates.flat();}
function analysisBounds(geometry){const pts=analysisRings(geometry).flat();return [Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];}
function analysisArea(geometry){const polygonArea=rings=>rings.reduce((total,ring,j)=>{let sum=0;for(let i=0;i<ring.length-1;i++)sum+=(ring[i+1][0]-ring[i][0])*Math.PI/180*(2+Math.sin(ring[i][1]*Math.PI/180)+Math.sin(ring[i+1][1]*Math.PI/180));return total+(j? -1:1)*Math.abs(sum)*6371008.8**2/2/1e6;},0);return geometry.type==='Polygon'?polygonArea(geometry.coordinates):geometry.coordinates.reduce((s,r)=>s+polygonArea(r),0);}
export function selectedAnalysisArea(input){
 if(input.geometry){const area=validatePolygon({name:input.name||'Çizilen alan',geometry:input.geometry});const region=checkAnalysisRegion(area.geometry);return {...area,regionId:region.id,regionName:region.name,kind:'polygon',boundarySource:'Kullanıcının çizdiği analiz alanı; drenaj havzası değildir'};}
 if(input.basinId){const f=ANALYSIS_BASINS.features.find(f=>f.properties.id===input.basinId);if(!f)throw new Error('Havza bulunamadı.');return {...f.properties,geometry:f.geometry,areaKm2:analysisArea(f.geometry),kind:'basin',boundarySource:f.properties.boundarySource};}
 const lat=Number(input.lat),lng=Number(input.lng);const region=Number.isFinite(lat)&&Number.isFinite(lng)?analysisRegionForPoint([lng,lat]):null;if(!region)throw new Error('İstanbul veya Ege Bölgesi içinde karada bir konum seç.');
 const dx=.5/(111.195*Math.cos(lat*Math.PI/180)),dy=.5/111.195;
 const geometry={type:'Polygon',coordinates:[[[lng-dx,lat-dy],[lng+dx,lat-dy],[lng+dx,lat+dy],[lng-dx,lat+dy],[lng-dx,lat-dy]]]};
 return {regionId:region.id,regionName:region.name,name:`${lat.toFixed(4)}° K, ${lng.toFixed(4)}° D`,geometry,areaKm2:analysisArea(geometry),kind:'point',boundarySource:'Seçili konum çevresinde 1 km² analiz hücresi; drenaj havzası değildir'};
}
export function analysisSamples(area){const [x0,y0,x1,y1]=analysisBounds(area.geometry),points=[];for(let y=0;y<9;y++)for(let x=0;x<9;x++){const point=[x0+(x+.5)*(x1-x0)/9,y0+(y+.5)*(y1-y0)/9];if(analysisContains(point,area.geometry))points.push({point,weight:Math.cos(point[1]*Math.PI/180)});}if(!points.length)throw new Error('Alan örneklenemedi.');const sum=points.reduce((s,p)=>s+p.weight,0);points.forEach(p=>p.weight/=sum);return points;}
export function corineSampleUrl(samples){return 'https://copernicus.discomap.eea.europa.eu/arcgis/rest/services/Corine/CLC2018_WM/MapServer/0/query?'+new URLSearchParams({f:'json',where:'1=1',geometry:JSON.stringify({points:samples.map(s=>s.point),spatialReference:{wkid:4326}}),geometryType:'esriGeometryMultipoint',inSR:'4326',outSR:'4326',outFields:'Code_18',returnGeometry:'true',geometryPrecision:'7',maxAllowableOffset:'0.00001',resultRecordCount:'1000'});}
export function classifyCorine(samples,data,group){
 if(data?.error||!Array.isArray(data?.features)||data.exceededTransferLimit)throw new Error('CORINE yanıtı eksik.');const byCode={};let missing=0,excluded=0;
 const classified=samples.map(s=>{const match=data.features.find(f=>Array.isArray(f.geometry?.rings)&&f.geometry.rings.reduce((c,r)=>c!==analysisRingContains(s.point,r),false));const code=String(match?.attributes?.Code_18||'');if(!/^\d{3}$/.test(code)){missing+=s.weight;return {...s,code:null};}if(!LAND_MODELS[code]){excluded+=s.weight;return {...s,code};}byCode[code]=(byCode[code]||0)+s.weight;return {...s,code};});
 if(missing>.05)throw new Error('CORINE örneklerinin %5’inden fazlası eksik; güvenilir hesap üretilemedi.');
 const landWeight=Object.values(byCode).reduce((s,w)=>s+w,0);if(landWeight<.5)throw new Error('Alan ağırlıkla su / sulak alan veya desteklenmeyen örtü içeriyor. Karada farklı bir konum seç.');
 return {classes:Object.entries(byCode).map(([code,weight])=>({code,...LAND_MODELS[code],cn:LAND_MODELS[code].cn['ABCD'.indexOf(group)],fraction:weight/landWeight,wholeAreaFraction:weight})).sort((a,b)=>b.fraction-a.fraction),classified,sampleCount:samples.length,validLandFraction:landWeight,missingFraction:missing,excludedFraction:excluded,year:2018,method:'9×9 düzenli iç nokta örneklemesi; enlem alan ağırlığı; kesin polygon alan oranı değildir',source:'Copernicus CORINE 2018 / EEA',sourceUrl:'https://land.copernicus.eu/en/products/corine-land-cover/clc2018'};
}
export function spatialForecastPoints(area,samples){if(area.kind==='point')return [{point:[(analysisBounds(area.geometry)[0]+analysisBounds(area.geometry)[2])/2,(analysisBounds(area.geometry)[1]+analysisBounds(area.geometry)[3])/2],weight:1}];const [x0,y0,x1,y1]=analysisBounds(area.geometry),groups=new Map();for(const s of samples){const x=Math.min(2,Math.floor(3*(s.point[0]-x0)/(x1-x0))),y=Math.min(2,Math.floor(3*(s.point[1]-y0)/(y1-y0))),key=x+','+y;const list=groups.get(key)||[];list.push(s);groups.set(key,list);}return [...groups.values()].map(list=>{const weight=list.reduce((s,p)=>s+p.weight,0),cx=list.reduce((s,p)=>s+p.point[0]*p.weight,0)/weight,cy=list.reduce((s,p)=>s+p.point[1]*p.weight,0)/weight;const nearest=list.reduce((a,b)=>Math.hypot(b.point[0]-cx,b.point[1]-cy)<Math.hypot(a.point[0]-cx,a.point[1]-cy)?b:a);return {point:nearest.point,weight};});}
export function analysisWeatherUrl(points){return 'https://api.open-meteo.com/v1/ecmwf?'+new URLSearchParams({latitude:points.map(p=>p.point[1]).join(','),longitude:points.map(p=>p.point[0]).join(','),hourly:'rain,precipitation,snowfall',models:'ecmwf_ifs',forecast_days:'4',timezone:'GMT',cell_selection:'land',precipitation_unit:'mm'});}
export function validateSpatialWeather(points,raw,now=Date.now()){const data=Array.isArray(raw)?raw:[raw];if(data.length!==points.length)throw new Error('ECMWF nokta sayısı eşleşmiyor.');return data.map((d,i)=>{if(!Number.isFinite(d.latitude)||!Number.isFinite(d.longitude)||Math.abs(d.latitude-points[i].point[1])>.3||Math.abs(d.longitude-points[i].point[0])>.3)throw new Error('ECMWF konumu uyuşmuyor.');return {hours:forecastHours(d,now),point:{lat:d.latitude,lng:d.longitude},weight:points[i].weight};});}
export function distributedHydrology(weather,cover,parameters,areaKm2,thresholds){
 const base=weather[0].hours.map(h=>({time:h.time,rain:0,runoff:0,cnRunoff:0,infiltration:0,percolation:0,soilStorageChange:0}));let storageChange=0;
 for(const w of weather)for(const c of cover.classes){const weight=w.weight*c.fraction,pervious=1-c.impervious;const r=hydrologySeries(w.hours,areaKm2,{...parameters,cn:c.cn});storageChange+=r.summary.soilStorageChange*pervious*weight;r.hourly.forEach((h,i)=>{if(h.time!==base[i].time)throw new Error('Tahmin zamanları eşleşmiyor.');const b=base[i];b.rain+=h.rain*weight;b.runoff+=(h.gaRunoff*pervious+h.rain*c.impervious)*weight;b.cnRunoff+=h.cnRunoff*weight;b.infiltration+=h.infiltration*pervious*weight;b.percolation+=h.percolation*pervious*weight;});}
 const sum=key=>base.reduce((s,h)=>s+h[key],0);let maxRain24=0,maxRunoff24=0,firstExceedance=null,level=0;
 for(let i=0;i<base.length;i++){const window=base.slice(Math.max(0,i-23),i+1),rain24=window.reduce((s,h)=>s+h.rain,0),runoff24=window.reduce((s,h)=>s+h.runoff,0);const l=Math.max(0,...thresholds.rain.map((t,j)=>rain24>=t?j+1:0),...thresholds.runoff.map((t,j)=>runoff24>=t?j+1:0));Object.assign(base[i],{rain24,runoff24,level:l});maxRain24=Math.max(maxRain24,rain24);maxRunoff24=Math.max(maxRunoff24,runoff24);if(l&&!firstExceedance)firstExceedance=base[i].time;level=Math.max(level,l);}
 let peakRainHour=null,maxRain1=0,maxRain3=0,peakRain3End=null;for(let i=0;i<base.length;i++){if(base[i].rain>maxRain1){maxRain1=base[i].rain;peakRainHour=base[i].time;}if(i>=2){const p3=base.slice(i-2,i+1).reduce((s,h)=>s+h.rain,0);if(p3>maxRain3){maxRain3=p3;peakRain3End=base[i].time;}}}const landAreaKm2=areaKm2*cover.validLandFraction;
 return {hourly:base,summary:{rainfall:sum('rain'),runoff:sum('runoff'),cnRunoff:sum('cnRunoff'),infiltration:sum('infiltration'),percolation:sum('percolation'),storageChange,waterBalanceError:sum('rain')-sum('runoff')-sum('percolation')-storageChange,runoffVolumeM3:sum('runoff')*landAreaKm2*1000,landAreaKm2,maxRain1,maxRain3,peakRainHour,peakRain3End,maxRain24,maxRunoff24,firstExceedance,level,cn:cover.classes.reduce((s,c)=>s+c.cn*c.fraction,0),impervious:cover.classes.reduce((s,c)=>s+c.impervious*c.fraction,0)}};
}
const analysisCache=new Map();
async function analysisFetch(url){const cached=analysisCache.get(url);if(cached&&Date.now()-cached.at<15*60000&&(!url.includes('api.open-meteo.com')||Math.floor(cached.at/3600000)===Math.floor(Date.now()/3600000)))return cached.data;const res=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!res.ok)throw new Error('Veri servisi HTTP '+res.status);const data=await res.json();if(analysisCache.size>100)analysisCache.clear();analysisCache.set(url,{at:Date.now(),data});return data;}
export async function analysisApi(request,env={}){
 const path=new URL(request.url).pathname;if(path==='/api/basins'&&request.method==='GET'){const region=new URL(request.url).searchParams.get('region');if(region&&!['istanbul','ege'].includes(region))return analysisJson({message:'Bölge İstanbul veya Ege olmalı.'},400);return analysisJson({...ANALYSIS_BASINS,features:ANALYSIS_BASINS.features.filter(f=>!region||f.properties.regionId===region)});}
 if(request.method!=='POST')return analysisJson({message:'POST gerekli'},405);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return analysisJson({message:'İstek kaynağı uyuşmuyor'},403);
 if(!request.headers.get('Content-Type')?.includes('application/json'))return analysisJson({message:'JSON gerekli'},415);
 let input,area,samples,points,group,parameters,thresholds;
 try{const text=await request.text();if(text.length>8e6)return analysisJson({message:'Veri boyutu çok büyük'},413);input=JSON.parse(text);area=selectedAnalysisArea(input);group=input.soilGroup||'B';if(!SOIL_SCENARIOS[group])throw new Error('Toprak grubu A–D olmalı.');const wet=input.wetness||'normal';if(!['dry','normal','wet'].includes(wet))throw new Error('Nem senaryosu geçersiz.');const moisture={dry:.15,normal:.2,wet:.35}[wet];parameters={...DEFAULT_HYDRO,...SOIL_SCENARIOS[group],initialMoisture:moisture,moistureDeficit:.45-moisture};if(input.ks!==undefined){if(!Number.isFinite(input.ks)||input.ks<.01||input.ks>300)throw new Error('Ks 0.01–300 mm/saat olmalı.');parameters.ks=input.ks;}thresholds={rain:[25,50,75],runoff:[10,25,50]};samples=analysisSamples(area);points=spatialForecastPoints(area,samples);}catch(e){return analysisJson({message:e.message},400);}
 const corineUrl=corineSampleUrl(samples),forecastUrl=analysisWeatherUrl(points);
 let corineRaw,weatherRaw;try{[corineRaw,weatherRaw]=await Promise.all([input.corineRaw||analysisFetch(corineUrl),input.weatherRaw||analysisFetch(forecastUrl)]);}catch(e){return analysisJson({message:'Canlı veri bu bağlantıdan alınamadı; alternatif bağlantı deneniyor.',corineUrl,forecastUrl},502);}
 try{const now=Date.now(),cover=classifyCorine(samples,corineRaw,group),weather=validateSpatialWeather(points,weatherRaw,now),hydro=distributedHydrology(weather,cover,parameters,area.areaKm2,thresholds);
 let wrf=null;if(input.wrf){const rows=input.wrf.hourly;if(!Array.isArray(rows)||rows.length!==72||!input.wrf.source||typeof input.wrf.source!=='string'||input.wrf.source.length>300||rows.some((r,i)=>r.time!==hydro.hourly[i].time||!Number.isFinite(r.rain)||r.rain<0||r.rain>500))throw new Error('WRF: kaynak adı ve ECMWF ile aynı 72 saatlik UTC zamanları / rain mm gerekli.');const imported=distributedHydrology([{hours:rows,weight:1}],cover,parameters,area.areaKm2,thresholds);wrf={...imported,source:input.wrf.source,providedBy:'Kullanıcı yüklemesi; model kökeni doğrulanmadı',spatialAssumption:'Alanı temsil ettiği kullanıcı tarafından varsayılır'};}
 return analysisJson({area,cover:{...cover,classified:undefined,samples:cover.classified.map(s=>({point:s.point,code:s.code}))},parameters,soilGroup:group,wetness:input.wetness||'normal',thresholds,...hydro,wrf,source:{provider:'ECMWF IFS HRES / Open-Meteo',model:'ecmwf_ifs',resolution:'Yaklaşık 9 km; saatlik tahmin',retrievedAt:new Date(now).toISOString(),modelRun:'API tarafından sağlanmıyor',forecastStart:new Date(Date.parse(hydro.hourly[0].time)-3600000).toISOString(),forecastEnd:hydro.hourly.at(-1).time,points:weather.map(w=>({point:w.point,weight:w.weight})),spatialMethod:area.kind==='point'?'1 ECMWF kara grid hücresi':'En fazla 9 mekânsal örneğin alan ağırlıklı ortalaması; tam raster havza ortalaması değil',ingested:!!input.weatherRaw,forecastTimeBasis:'UTC, interval end',validity:'72 contiguous future hourly intervals validated',observedRainfall:false},screeningOnly:true,limitations:{urbanDrainageModeled:false,channelCapacityModeled:false,observedSoilMoisture:false,localCalibration:false,warningProbability:false,reservoirRoutingModeled:false,basinBoundaryType:area.basinType||null}});
 }catch(e){return analysisJson({message:e.message},422);}
}
