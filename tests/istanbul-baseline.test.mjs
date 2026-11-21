import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
const root=new URL('../',import.meta.url),s=JSON.parse(await fs.readFile(new URL('research/istanbul-2026/results/study.json',root)));
test('Istanbul baseline matches full UTC gauge windows without selecting the best run',()=>{
 assert.equal(s.primaryPairs.length,10);assert.equal(s.rainfallMetrics.n,10);
 for(const p of s.primaryPairs){assert.equal((Date.parse(p.end)-Date.parse(p.start))/3600000,24);assert.equal((Date.parse(p.start)-Date.parse(p.run))/3600000,30);assert.equal((Date.parse(p.start)-Date.parse(p.assumedAvailableAt))/3600000,24);assert.ok(Number.isFinite(p.predicted));assert.ok(p.gridDistanceKm<20);}
 const b=s.primaryPairs.find(p=>p.stationId===18396&&p.end.startsWith('2026-10-15'));assert.equal(b.observed,186.3);assert.ok(Math.abs(b.predicted-26.1)<1e-8);
 assert.ok(Math.abs(s.rainfallMetrics.mae-94.18)<1e-8);assert.ok(s.primaryPairs.every(p=>p.error<0));
 assert.equal(s.floodValidation.falseAlarms,null);assert.equal(s.actualFloodLeadHours,null);assert.equal(s.assumptions.liveParametersChanged,false);
});
test('Istanbul archive covers 72 complete hours; coastal exclusion and water balance remain explicit',async()=>{
 assert.equal(s.runs.length,30);assert.equal(s.excluded.length,6);assert.ok(s.excluded.every(e=>e.locationId==='beykoz'));
 for(const r of s.runs){assert.equal(r.hourly.length,72);r.hourly.forEach((h,i)=>{assert.equal(Date.parse(h.time),Date.parse(r.assumedAvailableAt)+(i+1)*3600000);assert.ok(Number.isFinite(h.rain)&&h.rain>=0);});assert.ok(Math.abs(r.summary.waterBalanceError)<1e-6);}
 for(const [file,hash] of Object.entries(s.codeHashes)){const baseline=await fs.readFile(new URL(file,root));assert.equal(createHash('sha256').update(baseline).digest('hex'),hash);}
});
test('Istanbul study page switches real runs and shows excluded coast rather than inventing a result',async()=>{
 const html=await fs.readFile(new URL('research/istanbul-2026/results/istanbul-2026.html',root),'utf8');const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://hydro.test/istanbul-2026.html'}),w=dom.window;
 assert.equal(w.document.querySelectorAll('#hourly tbody tr').length,72);const loc=w.document.getElementById('location');loc.value='beykoz';loc.dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelectorAll('#hourly tbody tr').length,0);assert.ok(w.document.getElementById('detail').textContent.includes('yeterli değil'));
 loc.value='cebeci';loc.dispatchEvent(new w.Event('change'));assert.equal(w.document.querySelectorAll('#hourly tbody tr').length,72);assert.ok(w.document.querySelector('a[download][href$=".csv"]'));dom.window.close();
});
