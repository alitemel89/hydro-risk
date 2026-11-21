import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../worker/index.mjs';
test('public demo blocks shared saved areas and monitoring for GET and POST',async()=>{for(const path of ['/api/areas','/api/monitors','/api/monitors/configure','/api/monitoring/inputs','/api/monitoring/ingest','/api/hydrology'])for(const method of ['GET','POST']){const response=await handleApi(new Request('https://hydro.test'+path,{method}),{PUBLIC_DEMO:'true',DB:{prepare(){throw new Error('Private database must not be touched');}}});assert.equal(response.status,403);}});
