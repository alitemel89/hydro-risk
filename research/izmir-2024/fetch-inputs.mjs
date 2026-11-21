import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {selectedAnalysisArea,analysisSamples,corineSampleUrl} from '../../worker/analysis.mjs';
const root=new URL('./raw/',import.meta.url);
const observations=JSON.parse(await fs.readFile(new URL('observations.json',root),'utf8'));
const stations=[{id:'maydanoz',name:'Maydanoz yerleşim noktası',lat:37.9885022,lng:27.1783304},{id:'airport',name:'Adnan Menderes gözlem istasyonu',lat:38.292392,lng:27.156953}];
const jobs=[];
for(const o of observations.filter(o=>o.end>='2024-03-15'&&o.end<'2024-09-13')){
 const run=new Date(Date.parse(o.end)-30*3600000).toISOString().slice(0,16);
 jobs.push({file:'airport-'+run.replaceAll(':','-')+'.json',url:'https://single-runs-api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:stations[1].lat,longitude:stations[1].lng,hourly:'rain,precipitation',models:'ecmwf_ifs',run,forecast_days:'5',timezone:'GMT',precipitation_unit:'mm',cell_selection:'land'}),run,kind:'calibration'});
}
for(const run of ['2024-09-08T00:00','2024-09-08T12:00','2024-09-09T00:00','2024-09-09T06:00','2024-09-09T12:00','2024-09-09T18:00','2024-09-10T00:00','2024-09-10T06:00','2024-09-10T12:00','2024-09-10T18:00']){
 jobs.push({file:'event-'+run.replaceAll(':','-')+'.json',url:'https://single-runs-api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:stations.map(s=>s.lat).join(','),longitude:stations.map(s=>s.lng).join(','),hourly:'rain,precipitation',models:'ecmwf_ifs',run,forecast_days:'5',timezone:'GMT',precipitation_unit:'mm',cell_selection:'land'}),run,kind:'event'});
}
const area=selectedAnalysisArea(stations[0]);
jobs.push({file:'corine-maydanoz.json',url:corineSampleUrl(analysisSamples(area)),kind:'land-cover'});
let next=0;
async function download(job){
 let data;
 try{data=JSON.parse(await fs.readFile(new URL(job.file,root),'utf8'));}catch{}
 if(job.kind!=='land-cover'&&(Array.isArray(data)?data:[data]).some(d=>!Array.isArray(d?.hourly?.snowfall)))data=null;
 job.url=job.url.replace('rain%2Cprecipitation','rain%2Cprecipitation%2Csnowfall');
 if(!data){for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(job.url,{signal:AbortSignal.timeout(35000)});if(!r.ok)throw new Error('HTTP '+r.status);data=await r.json();if(data.error)throw new Error(data.reason||JSON.stringify(data.error));await fs.writeFile(new URL(job.file,root),JSON.stringify(data));break;}catch(e){if(attempt===2)throw e;await new Promise(resolve=>setTimeout(resolve,800));}
 }}
 job.sha256=createHash('sha256').update(await fs.readFile(new URL(job.file,root))).digest('hex');job.retrievedDate='2026-10-08';
 console.log(job.kind,job.run||'',job.file);
}
await Promise.all(Array.from({length:3},async()=>{while(next<jobs.length){const job=jobs[next++];await download(job);}}));
await fs.writeFile(new URL('../manifest.json',root),JSON.stringify({stations,model:'ECMWF IFS Cycle 49R1 hindcast, NOT a verified 2024 operational issue archive',jobs},null,2));
