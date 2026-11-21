import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {validatePolygon} from '../worker/geometry.mjs';
import {handleApi} from '../worker/index.mjs';
const body=()=>({name:'İzmir',geometry:{type:'Polygon',coordinates:[[[27,38],[27.01,38],[27.01,38.01],[27,38.01],[27,38]]]}});
test('polygon geometry rejects crossings, oversize, zero area, duplicates and backtracking',()=>{
 assert.ok(validatePolygon(body()).areaKm2>0);
 for(const points of [
 [[27,38],[27.01,38.01],[27,38.01],[27.01,38],[27,38]],
 [[27,38],[28,38],[28,39],[27,39],[27,38]],
 [[27,38],[27.01,38],[27.02,38],[27,38]],
 [[27,38],[27.01,38],[27.01,38],[27,38.01],[27,38]],
 [[27,38],[27.02,38],[27.01,38],[27.01,38.01],[27,38]]
 ])assert.throws(()=>validatePolygon({...body(),geometry:{type:'Polygon',coordinates:[points]}}));
});
test('create and reload area using real SQLite migration and prepared SQL',async()=>{
 const database=new DatabaseSync(':memory:');
 database.exec(await readFile(new URL('../drizzle/0000_high_quasimodo.sql',import.meta.url),'utf8'));
 const env={DB:{prepare(sql){const statement=database.prepare(sql);return {bind(...args){return {async run(){return statement.run(...args);}};},async all(){return {results:statement.all()};}};}}};
 const post=new Request('https://hydro.test/api/areas',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://hydro.test'},body:JSON.stringify(body())});
 const response=await handleApi(post,env);assert.equal(response.status,201);const area=await response.json();assert.equal(area.name,'İzmir');assert.ok(area.id);assert.ok(area.areaKm2>0);
 const list=await(await handleApi(new Request('https://hydro.test/api/areas'),env)).json();assert.equal(list.length,1);assert.deepEqual(list[0].geometry,body().geometry);
 const invalid=body();invalid.name='';assert.equal((await handleApi(new Request('https://hydro.test/api/areas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(invalid)}),env)).status,400);
 assert.equal((await handleApi(new Request('https://hydro.test/api/areas',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.test'},body:JSON.stringify(body())}),env)).status,403);
 database.close();
});
test('health exposes live analysis and historical engine readiness',async()=>{
 const res=await handleApi(new Request('https://hydro.test/api/health'),{});const data=await res.json();assert.equal(data.analysisReady,true);assert.equal(data.historyReady,true);assert.equal(data.datasets.corine.configured,true);
});
test('built worker serves Angular HTML and javascript with valid ESM fetch export',async()=>{
 const code=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
 const module=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 assert.equal(typeof module.default.fetch,'function');
 const res=await module.default.fetch(new Request('https://hydro.test/'),{});assert.equal(res.status,200);const html=await res.text();assert.match(html,/<hydro-app/);
 const file=html.match(/src="(main-[^"]+\.js)"/)[1];const asset=await module.default.fetch(new Request('https://hydro.test/'+file),{});assert.equal(asset.status,200);assert.match(asset.headers.get('Content-Type'),/javascript/);
 assert.equal((await module.default.fetch(new Request('https://hydro.test/missing'),{})).status,404);
});
