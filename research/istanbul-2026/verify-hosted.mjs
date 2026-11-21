import assert from 'node:assert/strict';
import worker from '../../dist/server/index.js';
for(const [path,mime] of [['/istanbul-2026.html','text/html'],['/data/istanbul-2026-study.json','application/json'],['/data/istanbul-2026-rainfall.csv','text/csv']]){
 const r=await worker.fetch(new Request('https://hydro.test'+path),{});assert.equal(r.status,200);assert.ok(r.headers.get('Content-Type').startsWith(mime));const text=await r.text();assert.ok(text.length>100);
 if(path.endsWith('.json')){const s=JSON.parse(text);assert.equal(s.primaryPairs.length,10);assert.equal(s.runs.length,30);}
 if(path.endsWith('.csv'))assert.equal(text.split('\n').length,11);
}
console.log('Hosted İstanbul report, JSON and CSV routes passed.');
