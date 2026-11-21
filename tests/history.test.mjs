import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forecastHours} from '../worker/hydrology.mjs';
import {HISTORICAL_STUDY as study} from '../worker/history-data.mjs';
import {handleApi} from '../worker/index.mjs';
import {completeWindow,historicalRows} from '../research/izmir-2024/methods.mjs';
test('convective precipitation enters runoff input; snow is excluded and missing snow fails closed',()=>{
 const now=Date.UTC(2026,9,8),time=Array.from({length:73},(_,i)=>new Date(now+i*3600000).toISOString().slice(0,16));
 const d={hourly_units:{rain:'mm',precipitation:'mm',snowfall:'cm'},hourly:{time,rain:Array(73).fill(.4),precipitation:Array(73).fill(28.1),snowfall:Array(73).fill(0)}};
 assert.equal(forecastHours(d,now)[0].rain,28.1);d.hourly.snowfall[1]=7;assert.equal(forecastHours(d,now)[0].rain,27.1);d.hourly.snowfall[1]=null;assert.throws(()=>forecastHours(d,now));delete d.hourly.snowfall;assert.throws(()=>forecastHours(d,now));
});
test('historical missing initial interval is never filled; missing within evaluation window rejects',()=>{
 const d={utc_offset_seconds:0,hourly_units:{precipitation:'mm',snowfall:'cm'},hourly:{time:['2024-09-10T00:00','2024-09-10T01:00','2024-09-10T02:00'],precipitation:[null,1,2],rain:[null,1,2],snowfall:[null,0,0]}};
 assert.equal(completeWindow(historicalRows(d),'2024-09-10T00:00Z','2024-09-10T02:00Z').length,2);
 d.hourly.precipitation[1]=null;assert.throws(()=>completeWindow(historicalRows(d),'2024-09-10T00:00Z','2024-09-10T02:00Z'));
});
test('event holdout and model provenance prohibit a claimed operational calibration',()=>{
 assert.equal(study.historicalArchiveType,'hindcast');assert.equal(study.verifiedOperationalReplay,false);assert.equal(study.actualFloodLeadHours,null);assert.equal(study.calibration.trainCount,19);assert.equal(study.calibration.testCount,2);assert.equal(study.calibration.factor,1);assert.equal(study.calibration.appliedToLive,false);
 const train=study.calibration.pairs.filter(p=>p.end<'2024-09-10'),testRows=study.calibration.pairs.filter(p=>p.end>='2024-09-10');assert.ok(testRows.every(p=>!train.some(t=>t.block===p.block)));
 assert.ok(study.calibration.candidates.every(c=>c.crossValidation.rmse>=study.calibration.candidates.find(x=>x.method==='identity').crossValidation.rmse));
 assert.equal(study.event.reportedGaugeCoordinates,null);assert.equal(study.event.floodOnset,null);
});
test('hindcasts use post-availability intervals and never compare a partial window with full daily observations',()=>{
 for(const r of study.runs){assert.equal(r.hourly.length,72);assert.equal(Date.parse(r.hourly[0].time)-Date.parse(r.availability),3600000);assert.ok(r.hourly.every(h=>Date.parse(h.time)>Date.parse(r.availability)));if(Date.parse(r.availability)>Date.parse('2024-09-10T06:00Z'))assert.equal(r.fullObservationWindowPredicted,null);}
 assert.equal(study.runs.filter(r=>r.stationId==='maydanoz'&&r.eventLevel>0).length,3);
});
test('all 36 sensitivity scenarios conserve water, retain initial storage and no zero-as-missing observations',()=>{
 assert.equal(study.sensitivity.length,36);
 for(const s of study.sensitivity){assert.ok(Math.abs(s.summary.rainfall-127.8)<1e-8);assert.ok(Math.abs(s.summary.waterBalanceError)<1e-7);}
 assert.ok(study.sensitivity.some(s=>s.summary.percolation>127.8&&s.summary.storageChange<0));
 assert.equal(study.calibration.pairs.find(p=>p.end==='2024-09-11T06:00:00Z').observed,1.66*25.4);
});
test('history API is read-only and returns auditable source labels',async()=>{
 const r=await handleApi(new Request('https://hydro.test/api/history'),{});assert.equal(r.status,200);const d=await r.json();assert.equal(d.id,study.id);assert.ok(d.sources.some(s=>s.url.includes('single-runs-api')));assert.equal((await handleApi(new Request('https://hydro.test/api/history',{method:'POST'}),{})).status,405);
});
