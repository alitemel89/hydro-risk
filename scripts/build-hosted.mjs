import {readFile,readdir,mkdir,writeFile,cp,rm} from 'node:fs/promises';
import {extname} from 'node:path';
const root=new URL('../',import.meta.url);
const source=new URL('../dist/web/browser/',import.meta.url);
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.gif':'image/gif'};
const assets={};
for(const [url,file,type] of [
 ['/istanbul-2026.html','istanbul-2026.html','text/html; charset=utf-8'],
 ['/data/istanbul-2026-study.json','study.json','application/json; charset=utf-8'],
 ['/data/istanbul-2026-rainfall.csv','paired-rainfall.csv','text/csv; charset=utf-8']
])assets[url]={body:(await readFile(new URL('../research/istanbul-2026/results/'+file,import.meta.url))).toString('base64'),type};
for(const file of await readdir(source,{recursive:true})){
 try {const bytes=await readFile(new URL(file,source));assets['/'+file]={body:bytes.toString('base64'),type:mime[extname(file)]||'application/octet-stream'};}catch(e){if(e.code!=='EISDIR')throw e;}
}
const reportBytes=await readFile(new URL('../research/izmir-2024/results/hydrorisk-izmir-2024-rapor.pdf',import.meta.url));
assets['/reports/hydrorisk-izmir-2024.pdf']={body:reportBytes.toString('base64'),type:'application/pdf'};
const geometry=await readFile(new URL('../worker/geometry.mjs',import.meta.url),'utf8');
const hydro=await readFile(new URL('../worker/hydrology.mjs',import.meta.url),'utf8');
const ege=await readFile(new URL('../worker/ege.mjs',import.meta.url),'utf8');
const istanbul=await readFile(new URL('../worker/istanbul.mjs',import.meta.url),'utf8');
const regions=(await readFile(new URL('../worker/regions.mjs',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
const monitoring=(await readFile(new URL('../worker/monitoring.mjs',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
const history=await readFile(new URL('../worker/history-data.mjs',import.meta.url),'utf8');
const basins=await readFile(new URL('../worker/basins.mjs',import.meta.url),'utf8');
const istanbulBasins=await readFile(new URL('../worker/istanbul-basins.mjs',import.meta.url),'utf8');
for(const [url,file] of [['/data/istanbul-dere-havzalari.geojson','istanbul-derived-basins.geojson'],['/data/istanbul-havzalari.geojson','istanbul-basins.geojson']])assets[url]={body:(await readFile(new URL('../research/istanbul-basins/'+file,import.meta.url))).toString('base64'),type:'application/geo+json; charset=utf-8'};
const analysis=(await readFile(new URL('../worker/analysis.mjs',import.meta.url),'utf8')).replace(/^import .*;$/gm,'');
const api=(await readFile(new URL('../worker/index.mjs',import.meta.url),'utf8')).replace("import {HISTORICAL_STUDY} from './history-data.mjs';",'').replace("import {analysisApi} from './analysis.mjs';",'').replace("import {monitoringApi} from './monitoring.mjs';",'').replace("import {validatePolygon} from './geometry.mjs';",'').replaceAll('export async function','async function').replaceAll('export function','function');
const worker=(geometry+'\n'+hydro+'\n'+ege+'\n'+istanbul+'\n'+regions+'\n'+monitoring+'\n'+basins+'\n'+istanbulBasins+'\n'+history+'\n'+analysis+'\n'+api).replaceAll('export async function','async function').replaceAll('export function','function').replaceAll('export const','const')+'\nconst assets='+JSON.stringify(assets)+`;
export default {async fetch(request,env){
const url=new URL(request.url);
if(url.pathname.startsWith('/api/'))return handleApi(request,env);
if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
const a=assets[url.pathname==='/'?'/index.html':url.pathname];
if(!a)return new Response('Not found',{status:404});
return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)),{headers:{'Content-Type':a.type,'Cache-Control':url.pathname==='/'?'no-cache':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}};
`;
await mkdir(new URL('../dist/server/',import.meta.url),{recursive:true});
await writeFile(new URL('../dist/server/index.js',import.meta.url),worker);
await rm(new URL('../dist/.openai/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('../dist/.openai/',import.meta.url),{recursive:true});
await cp(new URL('../.openai/hosting.json',import.meta.url),new URL('../dist/.openai/hosting.json',import.meta.url));
await cp(new URL('../drizzle/',import.meta.url),new URL('../dist/.openai/drizzle/',import.meta.url),{recursive:true});
console.log('Hosted Angular + Worker bundle hazır');
