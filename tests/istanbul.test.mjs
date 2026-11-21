import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analysisRegionForPoint,checkAnalysisRegion} from '../worker/regions.mjs';
import {selectedAnalysisArea,analysisApi,distributedHydrology,analysisSamples,spatialForecastPoints} from '../worker/analysis.mjs';
import {DEFAULT_HYDRO} from '../worker/hydrology.mjs';
const references=[[28.974,41.08],[28.82,41.012],[29.12,41.13],[29.61,41.17]];
test('Istanbul European and Asian reference points and polygons work; Ege retained',()=>{
 for(const [lng,lat] of references){assert.equal(analysisRegionForPoint([lng,lat])?.id,'istanbul');const area=selectedAnalysisArea({lat,lng});assert.equal(area.regionId,'istanbul');assert.ok(Math.abs(area.areaKm2-1)<.001);assert.equal(checkAnalysisRegion(area.geometry).id,'istanbul');assert.equal(selectedAnalysisArea({geometry:area.geometry}).regionId,'istanbul');}
 assert.equal(selectedAnalysisArea({lat:38.43,lng:27.16}).regionId,'ege');
 assert.equal(selectedAnalysisArea({basinId:'gediz'}).regionId,'ege');
 assert.equal(analysisRegionForPoint([29.065,41.1]),null);
 assert.throws(()=>selectedAnalysisArea({lat:39.93,lng:32.85}),/İstanbul veya Ege/);
 assert.throws(()=>checkAnalysisRegion({type:'Polygon',coordinates:[[[29.01,41.1],[29.1,41.1],[29.1,41.12],[29.01,41.12],[29.01,41.1]]]}),/boğaz/);
});
test('one-hour and three-hour rainfall peaks retain interval-end timestamps',()=>{
 const hours=[0,10,20,5,0].map((rain,i)=>({rain,time:new Date(Date.UTC(2026,9,15,i+1)).toISOString()}));
 const r=distributedHydrology([{hours,weight:1}],{classes:[{fraction:1,impervious:.65,cn:85}],validLandFraction:1},DEFAULT_HYDRO,1,{rain:[25,50,75],runoff:[10,25,50]});
 assert.equal(r.summary.maxRain1,20);assert.equal(r.summary.peakRainHour,hours[2].time);assert.equal(r.summary.maxRain3,35);assert.equal(r.summary.peakRain3End,hours[3].time);assert.ok(Math.abs(r.summary.waterBalanceError)<1e-6);
});
const req=body=>new Request('https://hydro.test/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
function fixture(){const start=Math.floor(Date.now()/86400000)*86400000,area=selectedAnalysisArea({lat:41.08,lng:28.974});const time=Array.from({length:120},(_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));const points=spatialForecastPoints(area,analysisSamples(area));return {lat:41.08,lng:28.974,weatherRaw:points.map(p=>({latitude:p.point[1],longitude:p.point[0],hourly_units:{precipitation:'mm',snowfall:'cm'},hourly:{time,precipitation:Array(120).fill(2),snowfall:Array(120).fill(0)}})),corineRaw:{features:[{attributes:{Code_18:'111'},geometry:{rings:[[[28,40],[30,40],[30,42],[28,42],[28,40]]]}}]}};}
test('Istanbul API uses CORINE cover with 72 validated future hours; missing/old data rejected',async()=>{
 const body=fixture(),res=await analysisApi(req(body));assert.equal(res.status,200);const r=await res.json();assert.equal(r.area.regionId,'istanbul');assert.equal(r.hourly.length,72);assert.equal(r.cover.classes[0].code,'111');assert.equal(r.summary.rainfall,144);assert.equal(r.source.observedRainfall,false);assert.equal(r.limitations.urbanDrainageModeled,false);assert.equal(r.screeningOnly,true);
 body.weatherRaw[0].hourly.time=body.weatherRaw[0].hourly.time.map(t=>new Date(Date.parse(t+'Z')-7*86400000).toISOString().slice(0,16));assert.equal((await analysisApi(req(body))).status,422);
 const missing=fixture();missing.weatherRaw[0].hourly.precipitation.fill(null);assert.equal((await analysisApi(req(missing))).status,422);
});
