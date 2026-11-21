export const HOUR=3600000;
export function historicalRows(data){
 if(data?.hourly_units?.precipitation!=='mm'||data?.hourly_units?.snowfall!=='cm'||data.utc_offset_seconds!==0)throw new Error('Arşiv birimi veya saat dilimi uyuşmuyor.');
 return data.hourly.time.map((t,i)=>{const total=data.hourly.precipitation[i],snow=data.hourly.snowfall[i];
  if(!Number.isFinite(total)||total<0||!Number.isFinite(snow)||snow<0||snow/7>total+.15)return {time:new Date(t+'Z').toISOString(),rain:null,solidPrecipitation:null,totalPrecipitation:total,largeScaleRain:data.hourly.rain[i]};
  return {time:new Date(t+'Z').toISOString(),rain:Math.max(0,total-snow/7),totalPrecipitation:total,solidPrecipitation:snow/7,largeScaleRain:data.hourly.rain[i]};
 });
}
export function completeWindow(rows,start,end){
 const a=Date.parse(start),b=Date.parse(end),hours=(b-a)/HOUR;
 const selected=rows.filter(r=>Date.parse(r.time)>a&&Date.parse(r.time)<=b);
 if(!Number.isInteger(hours)||hours<=0||selected.length!==hours||selected.some((r,i)=>Date.parse(r.time)!==a+(i+1)*HOUR||!Number.isFinite(r.rain)||r.rain<0))throw new Error('Kesintisiz tam saat aralığı ve eksiksiz yağış gerekli.');
 return selected;
}
export function skill(rows,key='predicted'){
 if(!rows.length)throw new Error('Doğrulama örneği yok.');
 const errors=rows.map(r=>r[key]-r.observed);
 return {n:rows.length,mae:errors.reduce((s,e)=>s+Math.abs(e),0)/rows.length,rmse:Math.sqrt(errors.reduce((s,e)=>s+e*e,0)/rows.length),bias:errors.reduce((s,e)=>s+e,0)/rows.length};
}
export function fitFactor(rows,method='leastSquares'){
 if(method==='identity')return 1;
 const numerator=rows.reduce((s,r)=>s+(method==='massRatio'?r.observed:r.predicted*r.observed),0);
 const denominator=rows.reduce((s,r)=>s+(method==='massRatio'?r.predicted:r.predicted*r.predicted),0);
 if(denominator<1e-9)throw new Error('Yağış katsayısı tanımlanamadı.');
 return Math.max(.1,Math.min(10,numerator/denominator));
}
export function groupedValidation(rows,method){
 return skill(rows.map(r=>({...r,corrected:r.predicted*fitFactor(rows.filter(x=>x.block!==r.block),method)})),'corrected');
}
export function rainContingency(rows,threshold){
 const count={hits:0,misses:0,falseAlarms:0,correctNegatives:0};
 for(const r of rows){const yes=r.observed>=threshold,forecast=r.predicted>=threshold;count[yes?(forecast?'hits':'misses'):(forecast?'falseAlarms':'correctNegatives')]++;}
 return {...count,n:rows.length,threshold,scope:'Eksiksiz eşleştirilen istasyon yağış günleri; taşkın doğrulaması değildir.'};
}
