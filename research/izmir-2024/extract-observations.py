"""Reproduce the conditional GSOD/ISD daily pairing from original NOAA CSVs.
Raw yearly CSVs can be downloaded from the source URLs in README.md.
No A–F partial daily values or missing-as-zero conversions are accepted.
"""
import csv, json, hashlib
from pathlib import Path
root=Path(__file__).resolve().parent
raw=root/'raw'
isd=list(csv.DictReader((raw/'adnan-menderes-2024.csv').open()))
gsod=list(csv.DictReader((raw/'gsod-2024.csv').open()))
precip=[{k:r[k] for k in ['STATION','DATE','REPORT_TYPE','LATITUDE','LONGITUDE']+list(k for k in r if k.startswith('AA'))} for r in isd if any(r[k] for k in r if k.startswith('AA'))]
(raw/'isd-precipitation-2024.json').write_text(json.dumps(precip,separators=(',',':')))
daily=[]
for d in gsod:
    if d['PRCP_ATTRIBUTES']!='G' or float(d['PRCP'])==99.99: continue
    pairs=[]
    for r in precip:
        if r['DATE'][:10]!=d['DATE']:continue
        for k,v in r.items():
            if not k.startswith('AA') or not v: continue
            a=v.split(',')
            if len(a)==4 and a[0]=='24' and a[1]!='9999' and a[3] in ['1','5'] and abs(int(a[1])/10-float(d['PRCP'])*25.4)<.14:pairs.append((r['DATE'],v))
    if len(set(pairs))==1:
        time,aa=pairs[0]
        daily.append({'end':time+'Z','mm':float(d['PRCP'])*25.4,'gsodInches':float(d['PRCP']),'gsodAttribute':'G','isdRaw':aa,'isdEnd':time+'Z'})
(raw/'observations.json').write_text(json.dumps(daily,indent=2))
sources=[{'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size} for p in [raw/'adnan-menderes-2024.csv',raw/'gsod-2024.csv']]
(root/'observation-manifest.json').write_text(json.dumps({'station':'17219099999','retrievedDate':'2026-10-08','sources':sources,'acceptedDays':len(daily),'conditionalGSODPairing':True},indent=2))
print(len(daily),'uniquely matched full-24-hour days; precipitation condition flags retained')
