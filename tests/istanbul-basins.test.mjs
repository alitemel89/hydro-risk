import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ISTANBUL_BASINS} from '../worker/istanbul-basins.mjs';
import {ANALYSIS_BASINS,selectedAnalysisArea,analysisSamples,spatialForecastPoints,analysisContains,analysisApi} from '../worker/analysis.mjs';
const req=(url,body)=>new Request('https://hydro.test'+url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});
test('catalog distinguishes 3 derived local drainage boundaries from 7 Ministry supply basins and preserves Ege',async()=>{
 assert.equal(ISTANBUL_BASINS.features.length,10);assert.equal(ANALYSIS_BASINS.features.length,14);assert.equal(ISTANBUL_BASINS.features.filter(f=>f.properties.basinType==='derived_drainage').length,3);assert.equal(ISTANBUL_BASINS.features.filter(f=>f.properties.basinType==='water_supply').length,7);
 const ist=await(await analysisApi(req('/api/basins?region=istanbul'))).json();assert.equal(ist.features.length,10);assert.ok(ist.features.every(f=>f.properties.regionId==='istanbul'));
 const ege=await(await analysisApi(req('/api/basins?region=ege'))).json();assert.equal(ege.features.length,4);assert.equal((await analysisApi(req('/api/basins?region=unknown'))).status,400);
});
test('each Istanbul basin retains geometry area, internal weighted samples and source provenance',()=>{
 for(const feature of ISTANBUL_BASINS.features){const p=feature.properties,area=selectedAnalysisArea({basinId:p.id}),samples=analysisSamples(area),points=spatialForecastPoints(area,samples);assert.equal(area.kind,'basin');assert.equal(area.regionId,'istanbul');assert.ok(area.areaKm2>50&&area.areaKm2<800);assert.ok(Math.abs(area.areaKm2/p.referenceAreaKm2-1)<.01);assert.ok(samples.length>12);assert.ok(samples.every(s=>analysisContains(s.point,area.geometry)));assert.ok(Math.abs(samples.reduce((s,p)=>s+p.weight,0)-1)<1e-10);assert.ok(points.length>1&&points.length<=9);assert.ok(points.every(s=>analysisContains(s.point,area.geometry)));assert.ok(p.sourceUrl.startsWith('https://'));assert.ok(area.boundarySource.length>20);if(p.basinType==='derived_drainage'){assert.equal(p.license,'ODbL-1.0');assert.ok(analysisContains(p.outlet,area.geometry));assert.ok(p.cellCount>10000);assert.match(p.boundaryStatus,/resmî değil/);}else assert.match(p.boundarySource,/Bakanlığı/);}
});
test('baraj and lower Alibey drainage boundaries remain different nested catchments',()=>{
 const river=selectedAnalysisArea({basinId:'istanbul-alibey-deresi'}),dam=selectedAnalysisArea({basinId:'istanbul-alibey-baraji'});assert.ok(river.areaKm2>dam.areaKm2);assert.notDeepEqual(river.geometry,dam.geometry);assert.match(river.notes,/toplanmamalı/);assert.equal(dam.basinType,'water_supply');assert.ok(selectedAnalysisArea({basinId:'istanbul-ayamama'}).areaKm2>60);
});
test('Istanbul catchment analysis uses distributed rainfall and reports reservoir-routing limitation',async()=>{
 const basinId='istanbul-kagithane',area=selectedAnalysisArea({basinId}),points=spatialForecastPoints(area,analysisSamples(area)),start=Math.floor(Date.now()/86400000)*86400000,time=Array.from({length:120},(_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));
 const body={basinId,soilGroup:'B',weatherRaw:points.map(p=>({latitude:p.point[1],longitude:p.point[0],hourly_units:{precipitation:'mm',snowfall:'cm'},hourly:{time,precipitation:Array(120).fill(2),snowfall:Array(120).fill(0)}})),corineRaw:{features:[{attributes:{Code_18:'112'},geometry:{rings:[[[27,40],[31,40],[31,42],[27,42],[27,40]]]}}]}};
 const res=await analysisApi(req('/api/analysis',body));assert.equal(res.status,200);const data=await res.json();assert.equal(data.hourly.length,72);assert.equal(data.area.id,basinId);assert.equal(data.area.regionId,'istanbul');assert.ok(data.source.points.length>1);assert.ok(Math.abs(data.summary.rainfall-144)<1e-8);assert.ok(Math.abs(data.summary.waterBalanceError)<1e-6);assert.equal(data.limitations.reservoirRoutingModeled,false);assert.equal(data.limitations.basinBoundaryType,'derived_drainage');assert.equal(data.screeningOnly,true);
});

test('deployed artifact exposes the ODbL derived database separately from Ministry data',async()=>{
 const fs=await import('node:fs/promises');const code=await fs.readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');const worker=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
 const r=await worker.fetch(new Request('https://hydro.test/data/istanbul-dere-havzalari.geojson'),{});assert.equal(r.status,200);assert.match(r.headers.get('Content-Type'),/geo\+json/);const data=await r.json();assert.equal(data.license,'ODbL-1.0');assert.equal(data.features.length,3);assert.ok(data.features.every(f=>f.properties.basinType==='derived_drainage'));
 const all=await(await worker.fetch(new Request('https://hydro.test/api/basins?region=istanbul'),{})).json();assert.equal(all.features.length,10);
});
