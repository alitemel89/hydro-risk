import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateArea} from '../libs/shared/src/validate-area.mjs';
const valid=()=>({name:' İzmir ',geometry:{type:'Polygon',coordinates:[[[27,38],[27.01,38],[27,38.01],[27,38]]]}});
test('normalizes name and retains longitude-first polygon',()=>assert.equal(validateArea(valid()).name,'İzmir'));
for(const [name,mutate] of [
 ['open ring',x=>x.geometry.coordinates[0].pop()],
 ['invalid coordinate',x=>x.geometry.coordinates[0][1][0]=181],
 ['nonfinite',x=>x.geometry.coordinates[0][1][0]=NaN],
 ['empty name',x=>x.name=' '],
 ['wrong geometry',x=>x.geometry.type='Point'],
 ['duplicate vertex',x=>x.geometry.coordinates[0][2]=[27.01,38]],
 ['holes',x=>x.geometry.coordinates.push(x.geometry.coordinates[0])]
]) test('rejects '+name,()=>{const x=valid();mutate(x);assert.throws(()=>validateArea(x));});
