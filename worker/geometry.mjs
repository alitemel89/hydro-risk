export function validatePolygon(body) {
 if(!body || typeof body !== 'object') throw new Error('Alan bilgisi gerekli');
 const name=typeof body.name==='string'?body.name.trim():'';
 if(!name || name.length>120) throw new Error('Alan adı 1–120 karakter olmalı.');
 const g=body.geometry;
 if(g?.type!=='Polygon'||!Array.isArray(g.coordinates)||g.coordinates.length!==1) throw new Error('Tek dış halkalı Polygon gerekli.');
 const ring=g.coordinates[0];
 if(!Array.isArray(ring)||ring.length<4||ring.length>1001)throw new Error('3–1000 köşe seç.');
 for(const pt of ring)if(!Array.isArray(pt)||pt.length!==2||!pt.every(Number.isFinite)||Math.abs(pt[0])>180||Math.abs(pt[1])>85)throw new Error('Koordinatlar geçersiz.');
 if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw new Error('Alan kapalı olmalı.');
 const pts=ring.slice(0,-1);
 if(new Set(pts.map(p=>p.join(','))).size!==pts.length)throw new Error('Tekrarlanan köşe var.');
 const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const on=(a,b,c)=>Math.abs(orient(a,b,c))<1e-12&&c[0]>=Math.min(a[0],b[0])-1e-12&&c[0]<=Math.max(a[0],b[0])+1e-12&&c[1]>=Math.min(a[1],b[1])-1e-12&&c[1]<=Math.max(a[1],b[1])+1e-12;
 for(let i=0;i<pts.length;i++){
  const a=ring[i],b=ring[i+1];
  if(Math.abs(b[0]-a[0])>180)throw new Error('Tarih değiştirme çizgisini aşan alan desteklenmiyor.');
  const prev=pts[(i+pts.length-1)%pts.length];
  if(Math.abs(orient(prev,a,b))<1e-12&&((prev[0]-a[0])*(b[0]-a[0])+(prev[1]-a[1])*(b[1]-a[1]))>0)throw new Error('Üst üste binen kenarlar var.');
  for(let j=i+1;j<pts.length;j++){
   if(j===i+1||(i===0&&j===pts.length-1))continue;
   const c=ring[j],d=ring[j+1];
   if(orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw new Error('Kenarlar kesişiyor. Köşeleri sırayla seç.');
  }
 }
 const rad=Math.PI/180,R=6371008.8;
 let sum=0;
 for(let i=0;i<pts.length;i++)sum+=(ring[i+1][0]-ring[i][0])*rad*(2+Math.sin(ring[i][1]*rad)+Math.sin(ring[i+1][1]*rad));
 const areaKm2=Math.abs(sum)*R*R/2/1e6;
 if(areaKm2<0.000001||areaKm2>100)throw new Error('Alan 1 m² ile 100 km² arasında olmalı.');
 return {name,geometry:{type:'Polygon',coordinates:[ring]},areaKm2};
}
