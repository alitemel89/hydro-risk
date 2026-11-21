import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DEFAULT_HYDRO} from '../../worker/hydrology.mjs';
import {selectedAnalysisArea,analysisSamples,classifyCorine,distributedHydrology,SOIL_SCENARIOS} from '../../worker/analysis.mjs';
import {HOUR,historicalRows,completeWindow,skill,rainContingency} from '../izmir-2024/methods.mjs';
const root=new URL('./',import.meta.url),read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const manifest=await read('manifest.json'),observations=await read('observations.json');
const assumptions={availabilityDelayHours:6,primaryRule:'Her gözlem penceresinin başlangıcından 30 saat önce başlatılan koşu; +6 saat erişim varsayımıyla pencere başlangıcına 24 saat kala.',soilGroup:'B',wetness:'normal',ks:10,corineYear:2018,liveParametersChanged:false,hydraulicRouting:false,forecastWindowHours:72};
const thresholds={rain:[25,50,75],runoff:[10,25,50]},parameters={...DEFAULT_HYDRO,...SOIL_SCENARIOS.B,initialMoisture:.2,moistureDeficit:.25};
const pairs=[],runs=[],excluded=[];
const haversine=(a,b)=>{const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r,q=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2;return 6371*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));};
for(const job of manifest.jobs.filter(j=>j.kind==='forecast')){
 const data=await read('raw/'+job.file);if(!Array.isArray(data)||data.length!==manifest.locations.length)throw new Error('Konum sırası / sayısı uyuşmuyor.');
 const issue=Date.parse(job.run+'Z'),available=issue+6*HOUR;
 for(const [i,location] of manifest.locations.entries()){
  const source=data[i];if(source.error)throw new Error(source.reason);
  const all=historicalRows(source),grid={lat:source.latitude,lng:source.longitude};
  if(haversine(location,grid)>20)throw new Error('Arşiv grid konumu beklenen hücreden çok uzak.');
  for(const obs of observations.filter(o=>o.istNo===location.stationId)){
   const primaryIssue=Date.parse(obs.start)-30*HOUR;if(issue!==primaryIssue)continue;
   if(available>Date.parse(obs.start))throw new Error('Gözlem başlangıcından sonra erişilen koşu.');
   const hours=completeWindow(all,obs.start,obs.end);if(hours.some(h=>h.solidPrecipitation>.01))throw new Error('Kar içeren ölçüm sıvı yağışla karşılaştırılamaz.');
   const predicted=hours.reduce((s,h)=>s+h.rain,0);
   pairs.push({locationId:location.id,stationId:obs.istNo,name:obs.istAd,start:obs.start,end:obs.end,observed:obs.deger,predicted,error:predicted-obs.deger,run:job.run+'Z',assumedAvailableAt:new Date(available).toISOString(),leadToWindowStartHours:24,station:{lat:obs.enlem,lng:obs.boylam},grid,gridDistanceKm:haversine(location,grid),sourceUrl:obs.sourceUrl,qualityStatus:obs.qualityStatus});
  }
  const hours=completeWindow(all,new Date(available).toISOString(),new Date(available+72*HOUR).toISOString());
  const area=selectedAnalysisArea(location),samples=analysisSamples(area),rawCover=await read('raw/'+manifest.jobs.find(j=>j.kind==='corine'&&j.locationId===location.id).file);
  let cover;try{cover=classifyCorine(samples,rawCover,'B');}catch(e){excluded.push({locationId:location.id,run:job.run,reason:e.message});continue;}
  const h=distributedHydrology([{hours,weight:1}],cover,parameters,area.areaKm2,thresholds);
  const eventRows=h.hourly.filter(row=>row.time>'2026-10-13T06:00:00.000Z'&&row.time<='2026-10-15T06:00:00.000Z');
  runs.push({locationId:location.id,name:location.name,stationId:location.stationId,run:job.run+'Z',assumedAvailableAt:new Date(available).toISOString(),grid,gridDistanceKm:haversine(location,grid),areaKm2:area.areaKm2,cover:{classes:cover.classes,validLandFraction:cover.validLandFraction,missingFraction:cover.missingFraction,excludedFraction:cover.excludedFraction},summary:h.summary,firstThresholds:[1,2,3].map(level=>({level,time:h.hourly.find(row=>row.level>=level)?.time||null})),eventWindow:{hoursCovered:eventRows.length,maxRain24:Math.max(0,...eventRows.map(row=>row.rain24)),maxRunoff24:Math.max(0,...eventRows.map(row=>row.runoff24)),maxLevel:Math.max(0,...eventRows.map(row=>row.level))},hourly:h.hourly});
 }
}
if(pairs.length!==observations.length)throw new Error('Ana değerlendirmede eşleşmemiş gözlem var.');
const study={schemaVersion:1,id:'istanbul-2026-10-14-baseline',generatedAt:new Date().toISOString(),baselineCommit:manifest.baselineCommit,status:'Ham model geriye dönük testi; kalibrasyon uygulanmadı',model:'ECMWF IFS HRES / Open-Meteo Single Runs; belgeye göre Ekim 2026 için Cycle 50R1',verifiedOperationalReplay:false,actualFloodLeadHours:null,assumptions,thresholds,locations:manifest.locations,observations,primaryPairs:pairs.sort((a,b)=>a.name.localeCompare(b.name)||a.end.localeCompare(b.end)),rainfallMetrics:{...skill(pairs),scope:'5 istasyon × aynı olaya ait 2 gün; 10 bağımsız olay değildir, kalite kontrolsüz MGM ölçümleri.'},rainfallThresholdChecks:[25,50,75].map(t=>rainContingency(pairs,t)),runs,excluded,floodValidation:{hits:null,misses:null,falseAlarms:null,reason:'Konum ve başlangıç saati doğrulanmış baskın envanteri ile baskın olmayan kontrol alanları yok. Belediye talepleri tek tek taşkın gözlemi sayılmaz.'},sources:[{label:'MGM 24 saatlik yağışlar · 06–06 UTC, kalite kontrolünden geçmemiş',url:'https://www.mgm.gov.tr/sondurum/toplam-yagis.aspx'},{label:'14 Ekim bitişli MGM ham kayıtları',url:'https://servis.mgm.gov.tr/web/sondurumlar/toplamyagis?tarih=2026-10-14'},{label:'15 Ekim bitişli MGM ham kayıtları',url:'https://servis.mgm.gov.tr/web/sondurumlar/toplamyagis?tarih=2026-10-15'},{label:'Meteoroloji Mühendisleri Odası · olay özeti',url:'https://meteorolojimuh.org.tr/istanbulda-14-ekim-2026-yagislari-kisa-sureli-siddetli-yagislar-ve-kentsel-taskin-riski-basin-bildirisi/'},{label:'Beykoz Belediyesi · etki kayıtları ve talep türleri',url:'https://www.beykoz.bel.tr/haberler/beykozda-rekor-yagis-1-879-talebin-tamamina-ulasildi'},{label:'Open-Meteo Single Runs · arşiv, model sürümü, erişim gecikmesi',url:'https://open-meteo.com/en/docs/single-runs-api'}],limitations:['Ölçümler saatlik değil; gözlenmiş pik şiddeti ve taşkın başlangıcı çıkarılamaz.','Grid yağışı istasyon noktasını ve çok yerel sağanağı tam temsil etmeyebilir.','Koşu başlangıcı ile dağıtım anı farklıdır; +6 saat kabul edildi, gerçek sunulma anı kaydı yok.','72 saat model penceresi +6 saatten sonra başlar; başlangıç toprağı B / normal senaryosudur, ölçülmüş nem değildir.','CORINE 2018, Ekim 2026 yapılaşmasını tam temsil etmez. Hücre hesabı yukarı drenaj havzası veya hidrolik taşkın yayılımı değildir.','Tek olaydan düzeltme katsayısı seçilmedi. Bağımsız olaylarla doğrulama yapılmadan canlı parametreler değişmedi.']};
await fs.writeFile(new URL('results/study.json',root),JSON.stringify(study,null,2));
const csv=[['station_id','station','start_utc','end_utc','model_run_utc','observed_mm','predicted_mm','error_mm','grid_distance_km'],...study.primaryPairs.map(p=>[p.stationId,p.name,p.start,p.end,p.run,p.observed,p.predicted,p.error,p.gridDistanceKm])].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
await fs.writeFile(new URL('results/paired-rainfall.csv',root),csv);
const baselineFiles=['worker/hydrology.mjs','worker/analysis.mjs','worker/regions.mjs'];study.codeHashes={};for(const file of baselineFiles)study.codeHashes[file]=createHash('sha256').update(await fs.readFile(new URL('../../'+file,root))).digest('hex');
await fs.writeFile(new URL('results/study.json',root),JSON.stringify(study,null,2));
console.log(JSON.stringify({rainfallMetrics:study.rainfallMetrics,primaryPairs:study.primaryPairs.map(p=>({station:p.name,end:p.end,observed:p.observed,predicted:p.predicted,error:p.error})),runs:runs.length,excluded},null,2));
