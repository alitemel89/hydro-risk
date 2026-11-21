import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DEFAULT_HYDRO} from '../../worker/hydrology.mjs';
import {selectedAnalysisArea,analysisSamples,classifyCorine,distributedHydrology,SOIL_SCENARIOS} from '../../worker/analysis.mjs';
import {HOUR,historicalRows,completeWindow,skill,fitFactor,groupedValidation,rainContingency} from './methods.mjs';
const root=new URL('./',import.meta.url),read=async p=>JSON.parse(await fs.readFile(new URL(p,root),'utf8'));
const manifest=await read('manifest.json'),observations=await read('raw/observations.json');
const pairs=[];let block=0,previous=0;
for(const o of observations.filter(o=>o.end>='2024-03-15'&&o.end<'2024-09-13')){
 const run=new Date(Date.parse(o.end)-30*HOUR).toISOString().slice(0,16),job=manifest.jobs.find(j=>j.kind==='calibration'&&j.run===run);
 const data=await read('raw/'+job.file),all=historicalRows(data),start=new Date(Date.parse(o.end)-24*HOUR).toISOString();
 const availableAt=new Date(Date.parse(run+'Z')+6*HOUR).toISOString();
 if(Date.parse(availableAt)>Date.parse(start))throw new Error('Gözlem aralığı tahminin erişiminden önce başlıyor.');
 const hours=completeWindow(all,start,o.end);if(hours.some(h=>h.solidPrecipitation>.01))throw new Error('Sıvı yağış hedefi için karlı eğitim günü çıkarılmalı.');
 if(Date.parse(o.end)-previous>48*HOUR)block++;
 pairs.push({start,end:o.end,run:run+':00Z',availableAt,observed:o.mm,predicted:hours.reduce((s,h)=>s+h.rain,0),block,grid:{lat:data.latitude,lng:data.longitude},observationAttribute:'GSOD G, eşleşen ISD 24 h / QC 1 veya 5',isdCondition:o.isdRaw.split(',')[2]});previous=Date.parse(o.end);
}
const train=pairs.filter(p=>p.end<'2024-09-10'),test=pairs.filter(p=>p.end>='2024-09-10');
const candidates=['identity','leastSquares','massRatio'].map(method=>({method,factor:fitFactor(train,method),crossValidation:groupedValidation(train,method)})).sort((a,b)=>a.crossValidation.rmse-b.crossValidation.rmse);
const selected=candidates[0];for(const p of pairs)p.corrected=p.predicted*selected.factor;
const calibration={status:'Yağış düzeltme deneyi tamamlandı; akış/perkolasyon fiziksel kalibrasyonu için gözlem eksik',station:manifest.stations[1],model:'IFS 49R1 yeniden tahmin',trainingWindow:'2024-03-15 – 2024-09-09',holdoutWindow:'11–12 Eylül 2024; aynı olaya ait 2 gün',trainCount:train.length,trainBlocks:new Set(train.map(r=>r.block)).size,testCount:test.length,candidates,selectedMethod:selected.method,factor:selected.factor,trainRaw:skill(train),trainCorrected:skill(train,'corrected'),testRaw:skill(test),testCorrected:skill(test,'corrected'),pairs,contingency:[1,25,50,75].map(t=>({raw:rainContingency(test,t),corrected:rainContingency(test.map(p=>({...p,predicted:p.corrected})),t)})),appliedToLive:false,limitations:[
 'Hedef GSOD G (tek tam 24 saatlik toplam); 99.99 / A–F / H / I günlük hedef olarak alınmadı. Eksikler sıfıra çevrilmedi.',
 'Gün sonu ISD 24 saatlik kayıtla ±0,14 mm toleransta tekil eşleştirildi. İnç yuvarlama çözünürlüğü 0,254 mm. GSOD ve ISD aynı üst kaynaktan türetilir, bağımsız iki ölçüm değildir.',
 'ISD koşul kodu 3 birikim başlangıcı işaretidir; ISD tek başına hedef kabul edilmedi. GSOD G toplam ve ISD zaman eşleştirmesi koşullu kullanılmaktadır; MGM ham kayıtlarıyla teyit gerekir.',
 'Eşleşen 19 eğitim günü tüm mevsimi temsil etmez; seçilim ve eksik kayıt etkisi vardır. İki test günü tek olaydır; bölgesel genelleme ve taşkın başarı oranı çıkarılamaz.',
 'Katsayı seçimi yalnız olay öncesi blokları dışarıda bırakan çapraz doğrulama RMSE ile yapıldı. 11–12 Eylül değerleri eğitimde kullanılmadı.',
 'Bu, 49R1 yeniden tahmininin tek istasyondaki yağış düzeltmesidir; güncel ECMWF sürümüne veya Maydanoz’a otomatik aktarılmaz.'
]};
const area=selectedAnalysisArea(manifest.stations[0]),samples=analysisSamples(area),corine=await read('raw/corine-maydanoz.json');
const thresholds={rain:[25,50,75],runoff:[10,25,50]},runs=[];
for(const job of manifest.jobs.filter(j=>j.kind==='event').sort((a,b)=>a.run.localeCompare(b.run))){
 const raw=await read('raw/'+job.file),issue=new Date(job.run+'Z').toISOString(),availability=new Date(Date.parse(issue)+6*HOUR).toISOString();
 for(let i=0;i<raw.length;i++){
  const hours=completeWindow(historicalRows(raw[i]),availability,new Date(Date.parse(availability)+72*HOUR).toISOString());
  const cover=classifyCorine(samples,corine,'B');
  const output=distributedHydrology([{hours,weight:1}],cover,{...DEFAULT_HYDRO,...SOIL_SCENARIOS.B},area.areaKm2,thresholds);
  const eventHours=output.hourly.filter(h=>h.time>='2024-09-10T21:00:00.000Z'&&h.time<='2024-09-11T09:00:00.000Z');
  const fixedStart=Date.parse('2024-09-10T06:00Z'),fixedEnd=Date.parse('2024-09-11T06:00Z');
  const fixed=Date.parse(availability)<=fixedStart?completeWindow(historicalRows(raw[i]),new Date(fixedStart).toISOString(),new Date(fixedEnd).toISOString()):null;
  runs.push({id:job.run+'-'+manifest.stations[i].id,stationId:manifest.stations[i].id,stationName:manifest.stations[i].name,issue,availability,availabilityAssumptionHours:6,grid:{lat:raw[i].latitude,lng:raw[i].longitude},...output,eventLevel:Math.max(0,...eventHours.map(h=>h.level)),eventMaxRain24:Math.max(0,...eventHours.map(h=>h.rain24)),eventFirstExceedance:eventHours.find(h=>h.level>0)?.time||null,fullObservationWindowPredicted:fixed?.reduce((s,h)=>s+h.rain,0)??null,fullObservationWindowLargeScaleOnly:fixed?.reduce((s,h)=>s+h.largeScaleRain,0)??null,hydrologyNote:i===0?'Maydanoz 1 km² hücre CORINE karışımı; drenaj havzası / çıkış debisi değil':'Yalnız meteorolojik kontrol noktası; akış hesabında karşılaştırma için Maydanoz örtüsü kullanılmıştır'});
  if(i===1){const r=runs.at(-1);r.meteorologyOnly=true;r.hydrologyNote='Havaalanı yalnız meteorolojik kontrol noktasıdır; bu nokta için akış veya perkolasyon sonucu verilmez.';r.hourly=r.hourly.map(h=>({time:h.time,rain:h.rain,rain24:h.rain24,level:Math.max(0,...thresholds.rain.map((t,j)=>h.rain24>=t?j+1:0))}));r.summary={rainfall:r.summary.rainfall,maxRain24:r.summary.maxRain24};const event=r.hourly.filter(h=>h.time>='2024-09-10T21:00:00.000Z'&&h.time<='2024-09-11T09:00:00.000Z');r.eventLevel=Math.max(0,...event.map(h=>h.level));r.eventFirstExceedance=event.find(h=>h.level>0)?.time||null;}
 }
}
const sensitivity=[];
for(const soilGroup of Object.keys(SOIL_SCENARIOS))for(const [wetness,initialMoisture] of Object.entries({dry:.15,normal:.2,wet:.35}))for(const duration of [6,12,24]){
 const hours=Array.from({length:72},(_,i)=>({time:new Date(Date.parse('2024-09-10T21:00Z')+(i+1)*HOUR).toISOString(),rain:i<duration?127.8/duration:0}));
 const cover=classifyCorine(samples,corine,soilGroup),parameters={...DEFAULT_HYDRO,...SOIL_SCENARIOS[soilGroup],initialMoisture,moistureDeficit:.45-initialMoisture};
 const output=distributedHydrology([{hours,weight:1}],cover,parameters,area.areaKm2,thresholds);
 sensitivity.push({id:soilGroup+'-'+wetness+'-'+duration,soilGroup,wetness,duration,parameters,...output});
}
const minmax=key=>[Math.min(...sensitivity.map(s=>s.summary[key])),Math.max(...sensitivity.map(s=>s.summary[key]))];
const study={schemaVersion:1,id:'izmir-menderes-2024-09-11',title:'11 Eylül 2024 · Menderes olay laboratuvarı',generatedAt:new Date().toISOString(),historicalArchiveType:'hindcast',verifiedOperationalReplay:false,actualFloodLeadHours:null,calibration,event:{date:'2024-09-11',name:'Ahmetbeyli / Maydanoz',reportedRain24Mm:127.8,reportedGaugeId:null,reportedGaugeCoordinates:null,reportedPeriodEnd:null,floodOnset:null,referenceRainWindow:{earliest:'2024-09-10T21:00:00Z',latest:'2024-09-11T03:00:00Z',status:'Gece yarısı–sabah ifadesinin deneysel aralığı; ölçülmüş taşkın başlangıcı değildir'},sourceUrl:'https://www.izmir.bel.tr/tr/Haberler/araclar-kurtarildi-sular-tahliye-edildi/50862/156'},area:{...area,name:'Maydanoz · 1 km² kıyı hücresi'},cover:{...classifyCorine(samples,corine,'B'),classified:undefined},thresholds,runs,sensitivity,sensitivityRanges:{runoff:minmax('runoff'),percolation:minmax('percolation'),cnRunoff:minmax('cnRunoff')},backtest:{stationRuns:20,uniqueIssues:10,maydanozWarningRuns:runs.filter(r=>r.stationId==='maydanoz'&&r.eventLevel>0).length,scope:'IFS 49R1 yeniden tahminiyle eşik testi; 2024’te dağıtılmış operasyonel tahmin veya doğrulanmış taşkın erken uyarı süresi değildir',availability:'Başlangıç + 6 saat varsayıldı. Gerçek dağıtım zamanı kaydı yok. Bu saatten önceki aralıklar kullanılmadı.'},missingData:[{data:'Ahmetbeyli / Maydanoz saatlik yağış',purpose:'Yağışın şiddet ve süre dağılımı',status:'MGM / İZSU ham istasyon kaydı gerekli'},{data:'Yerel debi veya seviye–debi bağıntısı',purpose:'Akış hacmi, tepe debi ve zamanlama kalibrasyonu',status:'11 Eylül 2024 açık zaman serisi bulunamadı; TATUS yalnız istasyon ve tekerrür alanları içeriyor'},{data:'Yukarı drenaj sınırı ve kesit / menfez',purpose:'Akım yönlendirme ve taşkın eşiği',status:'1 km² hücre veya Küçük Menderes ana havzası yerel derenin havzası yerine kullanılamaz'},{data:'Toprak nemi / infiltrasyon / drenaj ölçümü',purpose:'Ks, başlangıç nemi ve perkolasyonun tanımlanması',status:'Gözlemsiz tanımlanamaz'},{data:'Operasyonel ECMWF 48R1 olay öncesi çalışmaları',purpose:'Gerçek erken uyarı geriye dönük doğrulaması',status:'Açık erişilen arşiv 49R1 hindcast; MARS / kurum arşivi gerekli'},{data:'Olay WRF çalışma dosyaları',purpose:'Tamamlayıcı yüksek çözünürlüklü karşılaştırma',status:'Doğrulanmış olay WRF arşivi bulunamadı'}],sources:[{label:'İzmir Büyükşehir Belediyesi olay kaydı',url:'https://www.izmir.bel.tr/tr/Haberler/araclar-kurtarildi-sular-tahliye-edildi/50862/156'},{label:'Open-Meteo tek çalışma arşivi ve hindcast kökeni',url:'https://open-meteo.com/en/docs/single-runs-api'},{label:'ECMWF 49R1 uygulama tarihi: 12 Kasım 2024',url:'https://www.ecmwf.int/en/about/media-centre/news/2024/forecast-upgrade-improves-wind-and-temperature-predictions'},{label:'NOAA GSOD veri ve bayrak belgesi',url:'https://www.ncei.noaa.gov/data/global-summary-of-the-day/doc/readme.txt'},{label:'NOAA ISD bayrak ve birim belgesi',url:'https://www.ncei.noaa.gov/pub/data/noaa/isd-format-document.pdf'},{label:'TATUS akım gözlem istasyonları',url:'https://cbs1.tarimorman.gov.tr/server/rest/services/TATUS/FeatureServer/3'},{label:'DSİ açık akım gözlem yıllıkları',url:'https://www.dsi.gov.tr/sayfa/detay/744'},{label:'Open-Meteo yağış / sağanak / kar tanımları',url:'https://open-meteo.com/en/docs#hourly-parameter-definition'},{label:'CORINE 2018',url:'https://land.copernicus.eu/en/products/corine-land-cover/clc2018'},{label:'Maydanoz OSM yerleşim noktası',url:'https://www.openstreetmap.org/node/11109103703'}],notes:[
 '127,8 mm, kaynakta Menderes için bildirilen toplamdır; Maydanoz istasyonu veya havza ortalaması olarak kabul edilmedi.',
 '36 duyarlılık deneyi bu toplamın varsayımsal olarak hücreye homojen uygulanmasıdır. 6 / 12 / 24 saatlik düzgün dağılımlar sentetiktir; gerçek saatlik gözlem değildir.',
 'CORINE 2018, 2024 kentleşme değişikliklerini içermez. Geçirimsiz oran ve toprak grupları senaryodur.',
 'Perkolasyon toplamı başlangıç depolanmış sudan drenaj içerebilir; olay yağışından kaynaklanan akifer beslenmesi değildir.',
 'Akış ve perkolasyon ölçümü olmadığı için parametre uydurması, NSE veya doğrulanmış taşkın başarı yüzdesi üretilmedi.'
]};
study.dataAudit={sourceSnapshotSha256:createHash('sha256').update(JSON.stringify({manifest,observations})).digest('hex'),observationManifest:await read('observation-manifest.json'),hydrologyCodeSha256:createHash('sha256').update(await fs.readFile(new URL('../../worker/hydrology.mjs',root))).digest('hex')};
await fs.writeFile(new URL('results/study.json',root),JSON.stringify(study,null,2));
await fs.writeFile(new URL('../../worker/history-data.mjs',root),'// Generated by research/izmir-2024/run-study.mjs; do not hand-edit.\nexport const HISTORICAL_STUDY='+JSON.stringify(study)+';\n');
const csv=(rows,keys)=>keys.join(',')+'\n'+rows.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(',')).join('\n')+'\n';
await fs.writeFile(new URL('results/calibration-pairs.csv',root),csv(pairs,['start','end','run','availableAt','observed','predicted','corrected','block','isdCondition']));
await fs.writeFile(new URL('results/hindcast-runs.csv',root),csv(runs.map(r=>({...r,maxRain24:r.summary.maxRain24,runoff:r.summary.runoff,percolation:r.summary.percolation})),['stationId','issue','availability','eventLevel','eventMaxRain24','maxRain24','runoff','percolation','fullObservationWindowPredicted']));
await fs.writeFile(new URL('results/sensitivity.csv',root),csv(sensitivity.map(s=>({...s,...s.summary})),['soilGroup','wetness','duration','rainfall','runoff','percolation','storageChange','waterBalanceError','cnRunoff']));
console.log(JSON.stringify({calibration:{factor:calibration.factor,method:calibration.selectedMethod,candidates,train:calibration.trainRaw,test:calibration.testRaw,corrected:calibration.testCorrected},warnings:study.backtest,ranges:study.sensitivityRanges,cover:study.cover.classes.map(c=>({code:c.code,fraction:c.fraction})),maxBalance:Math.max(...sensitivity.map(s=>Math.abs(s.summary.waterBalanceError)))},null,2));
