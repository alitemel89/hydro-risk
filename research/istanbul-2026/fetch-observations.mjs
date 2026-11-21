import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url),observations=[],sources=[];
for(const date of ['2026-10-14','2026-10-15']){
 const sourceUrl='https://servis.mgm.gov.tr/web/sondurumlar/toplamyagis?tarih='+date,path=new URL('raw/mgm-'+date+'.json',root);
 let bytes;try{bytes=await fs.readFile(path);}catch{const r=await fetch(sourceUrl,{headers:{Origin:'https://www.mgm.gov.tr',Referer:'https://www.mgm.gov.tr/'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('MGM HTTP '+r.status);const rows=(await r.json()).filter(o=>o.il==='İstanbul');bytes=Buffer.from(JSON.stringify(rows,null,2));await fs.writeFile(path,bytes);}
 const data=JSON.parse(bytes);if(!Array.isArray(data)||data.some(o=>!o.tarih.startsWith(date)||o.il!=='İstanbul'))throw new Error('MGM tarih/il uyuşmuyor.');
 for(const o of data.filter(o=>[18396,17061,18980,18101,18402].includes(o.istNo))){if(!Number.isFinite(o.deger)||o.deger<0)throw new Error('Eksik gözlem');observations.push({...o,sourceUrl,qualityStatus:'MGM web sayfası: kalite kontrolünden geçmemiş değerler',start:new Date(Date.parse(o.tarih)-86400000).toISOString(),end:o.tarih});}
 sources.push({url:sourceUrl,file:'raw/mgm-'+date+'.json',sha256:createHash('sha256').update(bytes).digest('hex'),representation:'İstanbul kayıtlarının kayıpsız alan projeksiyonu; Türkiye geneli dışarıda.'});
}
if(observations.length!==10)throw new Error('Beklenen 5 istasyon × 2 gün yok.');
await fs.writeFile(new URL('observations.json',root),JSON.stringify(observations,null,2));
await fs.writeFile(new URL('observation-sources.json',root),JSON.stringify({retrievedAt:new Date().toISOString(),timeWindow:'Önceki gün 06:00 UTC – tarih 06:00 UTC; MGM sayfa sözleşmesi',qualityControlled:false,sources},null,2));
