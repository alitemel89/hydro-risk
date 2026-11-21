import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../worker/index.mjs';
const geometry={type:'Polygon',coordinates:[[[27,38],[27.01,38],[27.01,38.01],[27,38.01],[27,38]]]};
const request=()=>new Request('https://hydro.test/api/corine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({geometry})});
test('CORINE queries selected polygon and returns distinct real class codes without a risk score',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async(url,options)=>{assert.match(url,/CLC2018_WM\/MapServer\/0\/query$/);assert.deepEqual(JSON.parse(options.body.get('geometry')).rings,geometry.coordinates);assert.equal(options.body.get('outFields'),'Code_18');return Response.json({features:[{attributes:{Code_18:'112'}},{attributes:{Code_18:'311'}},{attributes:{Code_18:'112'}}]});};const response=await handleApi(request(),{});assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data.codes,['112','311']);assert.equal(data.riskScore,null);assert.equal(data.year,2018);
 globalThis.fetch=async()=>Response.json({features:[]});assert.equal((await(await handleApi(request(),{})).json()).status,'no_data');
 globalThis.fetch=async()=>{throw new Error('offline');};assert.equal((await handleApi(request(),{})).status,502);
 }finally{globalThis.fetch=original;}
});
