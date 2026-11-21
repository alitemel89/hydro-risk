// DOM integration check of the real compiled Angular bundle. Test fixtures are
// local to this process and never persisted as forecasts or deployed API data.
import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {handleApi} from '../../worker/index.mjs';
const dir=new URL('../../dist/web/browser/',import.meta.url),files=await fs.readdir(dir);
const errors=[],downloads=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(await fs.readFile(new URL('index.html',dir),'utf8'),{url:'https://hydro.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;w.SVGSVGElement.prototype.createSVGRect=()=>({});w.AbortSignal=globalThis.AbortSignal;w.AbortController=globalThis.AbortController;w.console=console;w.Blob=globalThis.Blob;w.URL.createObjectURL=()=> 'blob:local-qa';w.URL.revokeObjectURL=()=>{};
// Prevent jsdom's unsupported navigation while retaining download click events.
w.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
w.fetch=async(url,options={})=>{
 const resolved=new URL(url,w.location.href),headers=options.headers||{};let body=options.body;
 if(resolved.pathname==='/api/analysis'){
  const input=JSON.parse(body),start=Math.floor(Date.now()/86400000)*86400000,time=Array.from({length:120},(_,i)=>new Date(start+i*3600000).toISOString().slice(0,16));
  body=JSON.stringify({...input,weatherRaw:{latitude:input.lat,longitude:input.lng,hourly_units:{precipitation:'mm',snowfall:'cm'},hourly:{time,precipitation:Array(120).fill(2),snowfall:Array(120).fill(0)}},corineRaw:{features:[{attributes:{Code_18:'324'},geometry:{rings:[[[26,37],[29,37],[29,40],[26,40],[26,37]]]}}]}});
 }
 return handleApi(new Request(resolved,{method:options.method||'GET',headers,...(body?{body}:{})}),{});
};
w.eval(await fs.readFile(new URL(files.find(f=>/^main-.*\.js$/.test(f)),dir),'utf8'));
const wait=async(fn)=>{for(let i=0;i<120;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw new Error('DOM condition timed out');};
const button=text=>{const b=[...w.document.querySelectorAll('button')].find(x=>x.textContent.trim()===text);assert.ok(b,'button '+text);return b;};
const click=text=>button(text).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
await wait(()=>w.document.querySelector('.metric-list'));
click('2024 olay testi');await wait(()=>w.document.querySelectorAll('.run-picker button').length===10);
const runButtons=w.document.querySelectorAll('.run-picker button');runButtons[8].dispatchEvent(new w.MouseEvent('click',{bubbles:true}));await wait(()=>w.document.querySelector('.history-page').textContent.includes('Yüksek eşik · olay penceresinde'));
const selectors=w.document.querySelectorAll('.lab-controls select');for(const [i,value] of [[0,'D'],[1,'wet'],[2,'6']]){selectors[i].value=value;selectors[i].dispatchEvent(new w.Event('change',{bubbles:true}));}
await wait(()=>w.document.querySelector('.scenario-water').textContent.includes('109,0'));
const slider=w.document.querySelector('input[aria-label="Geçmiş tahmin saatini seç"]');slider.value='40';slider.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(()=>slider.value==='40');
click('Tüm deney verisi ↓');click('Eşleştirilmiş günler · CSV ↓');click('Gözlem veri şablonu ↓');
click('Yöntem & kaynaklar');await wait(()=>!w.document.querySelector('.about').hidden);
click('Canlı analiz');await wait(()=>!w.document.querySelector('main').hidden);
assert.deepEqual(downloads,['hydrorisk-izmir-2024-deney.json','hydrorisk-kalibrasyon-gunleri.csv','hydrorisk-gozlem-sablonu.json']);assert.deepEqual(errors,[]);console.log(JSON.stringify({compiledAngularDOM:true,modelIssues:10,scenarioControls:true,hourSlider:true,downloads:true,tabs:true,liveResult:true,layoutRendering:'Not evaluated by jsdom; native browser blocked by runtime socket permissions',errors}));
dom.window.close();
