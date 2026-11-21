export const DEFAULT_HYDRO={cn:75,initialAbstractionRatio:0.2,ks:10,suction:110,moistureDeficit:0.25,soilDepth:1000,initialMoisture:0.2,fieldCapacity:0.25,saturation:0.45,percolationRate:2,rainThresholds:[25,50,75],runoffThresholds:[10,25,50]};
export function hydroParameters(input={}){
 const p={...DEFAULT_HYDRO,...input};
 const ranges={cn:[30,98],initialAbstractionRatio:[0.05,0.2],ks:[0.01,300],suction:[1,1000],moistureDeficit:[0.01,0.6],soilDepth:[100,3000],initialMoisture:[0.01,0.6],fieldCapacity:[0.02,0.6],saturation:[0.03,0.7],percolationRate:[0,100]};
 for(const [key,[min,max]] of Object.entries(ranges))if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<min||p[key]>max)throw new Error(key+' parametresi geçersiz.');
 if(p.initialMoisture>p.saturation||p.fieldCapacity>=p.saturation||p.initialMoisture+p.moistureDeficit>p.saturation+1e-8)throw new Error('Toprak nemi, nem açığı ve doygunluk birbiriyle uyumlu olmalı.');
 for(const key of ['rainThresholds','runoffThresholds'])if(!Array.isArray(p[key])||p[key].length!==3||p[key].some((v,i)=>!Number.isFinite(v)||v<=0||(i&&v<=p[key][i-1])))throw new Error('Eşikler pozitif ve artan sırada olmalı.');
 return p;
}
export function curveNumberRunoff(p,cn,ratio=0.2){if(!Number.isFinite(p)||p<0||!Number.isFinite(cn)||cn<1||cn>100||!Number.isFinite(ratio)||ratio<0||ratio>1)throw new Error('Yağış veya CN geçersiz');if(cn===100)return p;const s=25400/cn-254,ia=ratio*s;return p<=ia?0:(p-ia)**2/(p-ia+s);}
function greenAmptStep(f,ks,a,dt){
 if(a<=0)return f+ks*dt;
 // Integrated ponded Green-Ampt: dF - a ln((F+a)/(F0+a)) = Ks dt.
 const g=x=>x-f-a*Math.log((x+a)/(f+a))-ks*dt;
 let lo=f,hi=f+ks*dt+Math.sqrt(2*a*ks*dt)+a;
 while(g(hi)<0)hi=f+2*(hi-f);
 for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(g(mid)>0)hi=mid;else lo=mid;}
 return (lo+hi)/2;
}
export function greenAmptInfiltration(f,ks,a,rainRate,dt){
 if(rainRate<=0)return 0;
 if(rainRate<=ks||a<=0)return Math.min(rainRate,ks)*dt;
 const pondingF=a/(rainRate/ks-1);
 const rainLimitedTime=Math.max(0,(pondingF-f)/rainRate);
 if(rainLimitedTime>=dt)return rainRate*dt;
 const before=rainLimitedTime*rainRate;
 return Math.min(rainRate*dt,before+greenAmptStep(f+before,ks,a,dt-rainLimitedTime)-(f+before));
}
export function hydrologySeries(hours,areaKm2,parameters){
 const p=hydroParameters(parameters);if(!hours.length||hours.some(h=>!Number.isFinite(h.rain)||h.rain<0))throw new Error('Yağış serisi eksik veya geçersiz.');
 let eventRain=0,eventRunoff=0,dryHours=0,f=0,soil=p.initialMoisture*p.soilDepth;
 const maxStore=p.saturation*p.soilDepth,fc=p.fieldCapacity*p.soilDepth,initialStore=soil,a=p.suction*p.moistureDeficit;
 const hourly=hours.map(h=>{
 if(h.rain>0){if(dryHours>=6){eventRain=0;eventRunoff=0;}dryHours=0;}else dryHours++;
 eventRain+=h.rain;const q=curveNumberRunoff(eventRain,p.cn,p.initialAbstractionRatio),cnRunoff=Math.max(0,q-eventRunoff);eventRunoff=q;
 let infiltration=0,gaRunoff=0,percolation=0;
 for(let step=0;step<12;step++){const available=h.rain/12;const cap=greenAmptInfiltration(f,p.ks,a,h.rain,1/12);const inf=Math.max(0,Math.min(available,cap,maxStore-soil));f+=inf;soil+=inf;infiltration+=inf;gaRunoff+=available-inf;const perc=Math.max(0,Math.min(p.percolationRate/12,soil-fc));soil-=perc;percolation+=perc;}
 return {...h,cnRunoff,cnVolumeM3:cnRunoff*areaKm2*1000,infiltration,gaRunoff,percolation,soilStorage:soil};
 });
 const total=key=>hourly.reduce((sum,h)=>sum+h[key],0);
 const rolling=(key,end)=>hourly.slice(Math.max(0,end-23),end+1).reduce((sum,h)=>sum+h[key],0);
 let level=0,firstExceedance=null;let maxRain24=0,maxRunoff24=0;
 for(let i=0;i<hourly.length;i++){const rain=rolling('rain',i),runoff=rolling('cnRunoff',i);maxRain24=Math.max(maxRain24,rain);maxRunoff24=Math.max(maxRunoff24,runoff);const l=Math.max(0,...p.rainThresholds.map((t,j)=>rain>=t?j+1:0),...p.runoffThresholds.map((t,j)=>runoff>=t?j+1:0));if(l&&!firstExceedance)firstExceedance=hourly[i].time;level=Math.max(level,l);hourly[i].screeningLevel=l;}
 const rainfall=total('rain'),cnRunoff=total('cnRunoff'),infiltration=total('infiltration'),gaRunoff=total('gaRunoff'),percolation=total('percolation');
 return {parameters:p,hourly,summary:{rainfall,cnRunoff,cnVolumeM3:cnRunoff*areaKm2*1000,infiltration,gaRunoff,percolation,soilStorageChange:soil-initialStore,waterBalanceError:rainfall-gaRunoff-percolation-(soil-initialStore),maxRain24,maxRunoff24,level,firstExceedance},methods:{runoff:'SCS-CN; 6 saat yağışsız arada olay sıfırlanır',infiltration:'Green-Ampt, 5 dakika adım',percolation:'Tarla kapasitesi üzerindeki suyun sınırlı drenajı (basitleştirilmiş depo modeli)',evapotranspiration:'0; yalnızca kısa süreli yağış senaryosu',calibration:'Kalibre edilmemiş kullanıcı senaryosu; CN ve Green-Ampt alternatif sonuçlardır'}};
}
export function forecastHours(data,now=Date.now()){
 if(data?.hourly_units?.precipitation!=='mm'||data?.hourly_units?.snowfall!=='cm'||!Array.isArray(data.hourly?.time)||!Array.isArray(data.hourly?.precipitation)||!Array.isArray(data.hourly?.snowfall))throw new Error('ECMWF toplam yağış veya kar verisi eksik.');
 const start=Math.floor(now/3600000)*3600000,rows=[];
 for(let i=0;i<data.hourly.time.length;i++){const time=Date.parse(data.hourly.time[i]+'Z');if(time>start&&rows.length<72){const total=data.hourly.precipitation[i],snow=data.hourly.snowfall[i];if(!Number.isFinite(total)||total<0||!Number.isFinite(snow)||snow<0||snow/7>total+.15)throw new Error('ECMWF yağış / kar serisi boş veya tutarsız.');rows.push({time:new Date(time).toISOString(),rain:Math.max(0,total-snow/7),solidPrecipitation:snow/7});}}
 if(rows.length!==72||rows.some((h,i)=>i&&Date.parse(h.time)-Date.parse(rows[i-1].time)!==3600000)||Date.parse(rows[0].time)!==start+3600000)throw new Error('72 saatlik güncel ve kesintisiz ECMWF tahmini alınamadı.');return rows;
}
