// DOM integration check of the real compiled Angular bundle. Test fixtures are
// local to this process and never persisted as forecasts or deployed API data.
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {selectedAnalysisArea,analysisSamples,spatialForecastPoints} from '../worker/analysis.mjs';
import {handleApi} from '../worker/index.mjs';
const dir=new URL('../dist/web/browser/',import.meta.url),files=await fs.readdir(dir);
const errors=[],downloads=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(await fs.readFile(new URL('index.html',dir),'utf8'),{url:'https://hydro.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;w.SVGSVGElement.prototype.createSVGRect=()=>({});w.AbortSignal=globalThis.AbortSignal;w.AbortController=globalThis.AbortController;w.console=console;w.crypto.randomUUID=()=>globalThis.crypto.randomUUID();w.Blob=globalThis.Blob;w.URL.createObjectURL=()=> 'blob:local-qa';w.URL.revokeObjectURL=()=>{};
// Prevent jsdom's unsupported navigation while retaining download click events.
w.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
const storedAreas=[];let riverMode='ok';let releaseRiver;let riverRequestCount=0;
w.fetch=async(url,options={})=>{
 if(String(url)==='/api/areas'){if(options.method==='POST'){const data={...JSON.parse(options.body),id:'qa-area',areaKm2:.02};storedAreas.push(data);return Response.json(data,{status:201});}return Response.json(storedAreas);}
 if(String(url).startsWith('https://overpass-api.de/'))return Response.json({elements:[{tags:{name:'Test deresi'},geometry:[{lon:27.16,lat:38.43},{lon:27.17,lat:38.44}]}]});
 const resolved=new URL(url,w.location.href),headers=options.headers||{};let body=options.body;
 if(resolved.pathname==='/api/rivers'){
  riverRequestCount++;
  if(riverMode==='timeout')throw new DOMException('Signal timed out','TimeoutError');
  if(riverMode==='pending')await new Promise(resolve=>{releaseRiver=resolve;});
  return Response.json({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Test deresi'},geometry:{type:'LineString',coordinates:[[28.97,41.08],[28.98,41.09]]}}],cacheHit:false});
 }

 if(resolved.pathname==='/api/analysis'){
  const input=JSON.parse(body),points=spatialForecastPoints(selectedAnalysisArea(input),analysisSamples(selectedAnalysisArea(input))),start=Math.floor(Date.now()/86400000)*86400000,time=Array.from({length:120},(_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));
  body=JSON.stringify({...input,weatherRaw:points.map(p=>({latitude:p.point[1],longitude:p.point[0],hourly_units:{precipitation:'mm',snowfall:'cm'},hourly:{time,precipitation:Array(120).fill(2),snowfall:Array(120).fill(0)}})),corineRaw:{features:[{attributes:{Code_18:'324'},geometry:{rings:[[[26,37],[31,37],[31,42],[26,42],[26,37]]]}}]}});
 }
 return handleApi(new Request(resolved,{method:options.method||'GET',headers,...(body?{body}:{})}),{});
};
w.eval(await fs.readFile(new URL(w.document.querySelector('script[type="module"][src]').getAttribute('src'),dir),'utf8'));
const wait=async(fn)=>{for(let i=0;i<120;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw new Error('DOM condition timed out');};
const button=text=>{const b=[...w.document.querySelectorAll('button')].find(x=>x.textContent.trim()===text);assert.ok(b,'button '+text);return b;};
const click=text=>button(text).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
await wait(()=>w.document.querySelector('.metric-list'));
assert.ok(w.document.querySelector('.short-rain').textContent.includes('En yüksek ardışık 3 saat'));
assert.ok(w.document.body.textContent.includes('İSTANBUL & EGE'));
click('Ege');await wait(()=>w.document.querySelector('.selection-footer').textContent.includes('38.4300'));await wait(()=>w.document.querySelector('.metric-list'));
click('İstanbul');await wait(()=>w.document.querySelector('.selection-footer').textContent.includes('41.0800'));await wait(()=>w.document.querySelector('.metric-list'));
const reference=w.document.querySelector('[aria-label="İstanbul referans konumu"]');reference.value='beykoz';reference.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>w.document.querySelector('.selection-footer').textContent.includes('29.1200'));await wait(()=>w.document.querySelector('.metric-list'));

assert.ok(!w.document.body.textContent.includes('Tesis portföyü'));
const corine=w.document.querySelector('.map-tools input');corine.checked=true;corine.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>w.document.querySelector('.map-note')?.textContent.includes('81 CORINE'));
assert.ok(w.document.querySelectorAll('#map .leaflet-interactive').length>80);
const river=w.document.querySelectorAll('.map-tools input')[1];riverMode='timeout';river.checked=true;river.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>w.document.querySelector('.river-retry'));
assert.ok(w.document.querySelector('.map-note').textContent.includes('zamanında alınamadı'));assert.ok(!w.document.querySelector('.map-note').textContent.includes('Signal timed out'));
riverMode='ok';click('Tekrar dene');await wait(()=>w.document.querySelector('.map-note')?.textContent.includes('1 yerel akarsu'));assert.equal(w.document.querySelector('.river-retry'),null);
river.checked=false;river.dispatchEvent(new w.Event('change',{bubbles:true}));riverMode='pending';river.checked=true;river.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>typeof releaseRiver==='function');river.checked=false;river.dispatchEvent(new w.Event('change',{bubbles:true}));releaseRiver();await new Promise(resolve=>setTimeout(resolve,50));assert.equal(river.checked,false);assert.ok(w.document.querySelector('.map-note').textContent.includes('gizlendi'));riverMode='ok';assert.equal(riverRequestCount,3);

click('Alan çiz');await wait(()=>w.document.querySelector('.draw-toolbar'));
const map=w.document.querySelector('#map');for(const [x,y] of [[0,0],[2,0],[2,2]])map.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:x,clientY:y}));
await wait(()=>w.document.querySelector('.draw-toolbar').textContent.includes('3 köşe'));
click('Son köşeyi geri al');await wait(()=>w.document.querySelector('.draw-toolbar').textContent.includes('2 köşe'));
map.dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:2,clientY:2}));click('Alanı tamamla');await wait(()=>w.document.querySelector('.metric-list'));
assert.ok(w.document.querySelector('.selection-footer').textContent.includes('Çalışma alanı'));
assert.ok(w.document.querySelector('.map-note')?.textContent.includes('CORINE örnek noktası'));
assert.ok(w.document.querySelectorAll('.draw-vertex').length===3);
click('Alanı kaydet');await wait(()=>w.document.querySelector('.saved-area-chip'));
assert.equal(JSON.parse(w.localStorage.getItem('hydrorisk-demo-areas-v1')).length,1);click('Konum');click('Alan çiz');await wait(()=>w.document.querySelector('.draw-toolbar').textContent.includes('0 köşe'));assert.equal(w.document.querySelectorAll('.draw-vertex').length,0);assert.ok(map.classList.contains('drawing-active'));w.document.querySelector('.saved-area-chip').click();await wait(()=>w.document.querySelector('.draw-toolbar').textContent.includes('Köşeleri düzenle'));assert.equal(w.document.querySelectorAll('.draw-vertex').length,3);assert.ok(!map.classList.contains('drawing-active'));
click('GeoJSON indir ↓');assert.ok(downloads.includes('hydrorisk-alan.geojson'));
click('Konum');await wait(()=>w.document.querySelector('.metric-list'));
click('Havza');await wait(()=>w.document.querySelector('#basin-choice'));await wait(()=>w.document.querySelector('.metric-list'));
assert.equal(w.document.querySelectorAll('#basin-choice option').length,10);
assert.equal(w.document.querySelector('#basin-choice').value,'istanbul-ayamama');
assert.equal(w.document.querySelector('.basin-context').getAttribute('data-basin-kind'),'derived_drainage');
assert.ok(w.document.querySelector('.basin-context').textContent.includes('resmî değil'));
let basinChoice=w.document.querySelector('#basin-choice');basinChoice.value='istanbul-omerli';basinChoice.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>w.document.querySelector('.selection-footer').textContent.includes('Ömerli Barajı'));await wait(()=>w.document.querySelector('.metric-list'));
assert.ok(w.document.querySelector('.selection-footer').textContent.includes('Ömerli Barajı'));
assert.equal(w.document.querySelector('.basin-context').getAttribute('data-basin-kind'),'water_supply');
click('Ege');await wait(()=>w.document.querySelectorAll('#basin-choice option').length===4);await wait(()=>w.document.querySelector('.metric-list'));
click('İstanbul');await wait(()=>w.document.querySelectorAll('#basin-choice option').length===10);await wait(()=>w.document.querySelector('.metric-list'));
basinChoice=w.document.querySelector('#basin-choice');basinChoice.value='istanbul-kagithane';basinChoice.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>w.document.querySelector('.selection-footer').textContent.includes('Kağıthane Deresi'));await wait(()=>w.document.querySelector('.metric-list'));
assert.ok(w.document.querySelector('.selection-footer').textContent.includes('Kağıthane Deresi'));
click('Havzayı GeoJSON indir');assert.ok(downloads.includes('hydrorisk-istanbul-kagithane.geojson'));
assert.equal(errors.length,0,errors.join('\n'));dom.window.close();console.log('Map UI: portfolio removed, CORINE visible, polygon draw/undo/analysis passed');
