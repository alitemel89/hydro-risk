import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../worker/index.mjs';
const geometry={type:'Polygon',coordinates:[[[27.15,38.42],[27.16,38.42],[27.16,38.43],[27.15,38.43],[27.15,38.42]]]};
const req=()=>new Request('https://local/api/rivers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({geometry})});
test('river service returns geometry with source, rejects incomplete upstream and never invents features',async()=>{
 const original=globalThis.fetch;
 try{
 globalThis.fetch=async()=>new Response(JSON.stringify({elements:[{type:'way',id:1,tags:{name:'Dere',waterway:'stream'},geometry:[{lon:27.15,lat:38.42},{lon:27.16,lat:38.43}]}]}));
 let res=await handleApi(req(),{}),data=await res.json();assert.equal(res.status,200);assert.equal(data.features[0].geometry.coordinates[0][0],27.15);assert.equal(data.riskContribution,false);
 globalThis.fetch=async()=>new Response(JSON.stringify({remark:'timeout',elements:[]}));res=await handleApi(req(),{});assert.equal(res.status,503);
 globalThis.fetch=async()=>new Response(JSON.stringify({elements:[]}));res=await handleApi(req(),{});data=await res.json();assert.equal(res.status,200);assert.equal(data.features.length,0);
 }finally{globalThis.fetch=original;}
});

test('river lookup falls back after timeout; both failures return a retryable Turkish error',async()=>{
 const original=globalThis.fetch;let calls=[];
 try{
 globalThis.fetch=async(url,options)=>{calls.push(String(url));assert.equal(options.method,'POST');assert.match(String(options.body),/timeout/);if(calls.length===1)throw new DOMException('Signal timed out','TimeoutError');return Response.json({elements:[{type:'way',id:2,tags:{name:'Yedek dere'},geometry:[{lon:27.15,lat:38.42},{lon:27.16,lat:38.43}]}]});};
 let r=await handleApi(req(),{}),d=await r.json();assert.equal(r.status,200);assert.equal(calls.length,2);assert.ok(calls[0].includes('private.coffee'));assert.ok(calls[1].includes('maps.mail.ru'));assert.equal(d.features[0].properties.name,'Yedek dere');
 globalThis.fetch=async()=>{throw new DOMException('Signal timed out','TimeoutError');};r=await handleApi(req(),{});d=await r.json();assert.equal(r.status,503);assert.equal(d.retryable,true);assert.equal(d.code,'RIVERS_UNAVAILABLE');assert.ok(!d.message.includes('Signal timed out'));
 }finally{globalThis.fetch=original;}
});
test('valid river responses use the edge cache; incomplete responses never populate it',async()=>{
 const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;const cache=new Map();let calls=0;
 try{
 globalThis.caches={default:{async match(request){return cache.get(request.url)?.clone();},async put(request,response){cache.set(request.url,response.clone());}}};
 globalThis.fetch=async()=>{calls++;return Response.json({elements:[]});};
 let r=await handleApi(req(),{});assert.equal((await r.json()).cacheHit,false);r=await handleApi(req(),{});assert.equal((await r.json()).cacheHit,true);assert.equal(calls,1);cache.clear();
 globalThis.fetch=async()=>Response.json({remark:'timeout',elements:[]});r=await handleApi(req(),{});assert.equal(r.status,503);assert.equal(cache.size,0);
 }finally{globalThis.fetch=originalFetch;if(originalCaches===undefined)delete globalThis.caches;else globalThis.caches=originalCaches;}
});

test('small selection falls back to OSM node/way data with explicit reduced coverage',async()=>{
 const original=globalThis.fetch;let calls=0;
 try{
 globalThis.fetch=async url=>{calls++;if(!String(url).includes('openstreetmap.org/api/0.6/map.json'))throw new DOMException('Timeout','TimeoutError');return Response.json({elements:[{type:'node',id:7,lon:27.15,lat:38.42},{type:'node',id:8,lon:27.16,lat:38.43},{type:'way',id:9,tags:{waterway:'stream',name:'Gerçek kaynak'},nodes:[7,8]}]});};
 const r=await handleApi(req(),{}),data=await r.json();assert.equal(r.status,200);assert.equal(calls,3);assert.equal(data.method,'selection_bbox_no_buffer');assert.match(data.coverageNote,/tamponu dahil değil/);assert.deepEqual(data.features[0].geometry.coordinates,[[27.15,38.42],[27.16,38.43]]);assert.equal(data.riskContribution,false);
 }finally{globalThis.fetch=original;}
});
