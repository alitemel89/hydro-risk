# 11 September 2024 İzmir / Menderes study

Two experiments are deliberately reported separately: (1) station precipitation bias correction with an event holdout; (2) retrospective ECMWF **49R1 hindcast** warning screening. Neither establishes physically calibrated discharge/percolation or the operational flood lead time in September 2024.

## Reproduce

Node 24 and Python 3; no additional packages are required for the computations.

1. Download original observations:
   - ISD: `https://www.ncei.noaa.gov/data/global-hourly/access/2024/17219099999.csv` → `raw/adnan-menderes-2024.csv`
   - GSOD: `https://www.ncei.noaa.gov/data/global-summary-of-the-day/access/2024/17219099999.csv` → `raw/gsod-2024.csv`
2. `python research/izmir-2024/extract-observations.py`
3. `node --use-env-proxy research/izmir-2024/fetch-inputs.mjs` (without the flag if no proxy is required).
4. `node research/izmir-2024/run-study.mjs`
5. `npm test` and `npm run build:hosted`.

Cached API responses, request URLs and SHA-256 hashes are included. The full ISD annual weather file and global station inventory are excluded from git; the lossless precipitation-field projection and their source references are retained. CORINE raw query is included. Reports are generated with `make-report.py` (matplotlib and reportlab required only for the report).

## Observation handling

The target is the published GSOD G total (one full 24-hour precipitation report), converted with 25.4 mm/inch. A–F partial daily summaries, H/I incomplete summaries and 99.99 missing values are excluded. A unique same-date ISD 24-hour amount / QC 1 or 5 within ±0.14 mm supplies the accumulation endpoint. GSOD rounding is 0.254 mm; this tolerance allows half a GSOD step plus ISD rounding. GSOD and ISD share an upstream observation and are not independent measurements.

**Important:** nonzero ISD rows carry condition code 3, documented as a begin-accumulated-period marker. ISD alone is not used as a trusted rainfall target. We use the explicitly published GSOD G target with conditional ISD timestamp matching, retain the flags, and require confirmation against MGM original SYNOP/automatic station records before accepting a calibrated operational model. Flag 9 in the condition field can be absent trace status, not a missing depth; depth, period and QC are checked separately. This ambiguity is visible in the Site and report.

Only 19 complete uniquely matched daily observations from 15 March–9 September enter training (12 temporal blocks; gaps over 48 hours start a new block). The 11–12 September event's two daily totals are held out together. This incomplete selected sample cannot estimate regional skill or flood hit/false-alarm rates. Multiplicative least-squares and mass-ratio factors are compared with identity using leave-one-block-out RMSE; identity wins. Neither nonidentity factor is applied to live forecasts.

## Retrospective screening

Ten initialization times (8–10 September) are requested at Maydanoz and the airport. Open-Meteo explicitly documents these as 49R1 hindcasts, not operational 48R1 outputs distributed in 2024. Initialization+6 hours is an assumed availability cutoff, not a verified publish timestamp. Exactly 72 later hourly accumulation endpoints are used. Only when availability precedes the observation's start is a full daily observation matched to a full forecast window; partial forecasts never receive a full-day score.

The event screening window is 10 September 21 UTC–11 September 09 UTC (11 September 00–12 TR), an experimental window covering the municipal record's midnight/morning description. First model threshold time is not flood onset. No exact onset record or operational ECMWF release archive was found; **actualFloodLeadHours is null**. Three Maydanoz runs exceed an unchanged screening threshold. This is 3/10 initializations of one hindcast event, not a 30% flood detection rate. Rain thresholds 25/50/75 and runoff thresholds 10/25/50 mm remain uncalibrated.

## Hydrology

36 scenarios vary A–D soil presets, dry/normal/wet initial water storage, and 6/12/24-hour uniform distributions of 127.8 mm. The 127.8 mm is a reported Menderes district total with unidentified gauge and endpoint; it is NOT a measured Maydanoz hyetograph or catchment-average forcing. CORINE 2018 in the coastal 1 km² cell has approximately 72.8% modelable land. This is not the upstream watershed of the damaged road. No routing, discharge score or physical parameter fit is attempted without local rainfall and runoff observations. Percolation may exceed event rainfall by draining initial storage.

## Change discovered by validation

The earlier live prototype used Open-Meteo `rain`, which excludes convective showers. Validation exposed this. The new implementation requires `precipitation` in mm and `snowfall` in cm and computes liquid precipitation `max(0, precipitation - snowfall/7)`. The documented 7:1 conversion removes solid precipitation; snowmelt remains unmodeled. At Maydanoz, the same 10 September 00 UTC hindcast has 0.4 mm large-scale rain but 28.1 mm total liquid precipitation in the 06–06 UTC window. Missing component data fails closed.

## Remaining evidence needed

MGM/İZSU raw hourly rain, local stage/discharge with rating curve, upstream catchment and road/culvert cross-section, actual flood timestamps, soil/infiltration/drainage observations, and original operational ECMWF 48R1 issue files (e.g. institution/MARS archive). No verified WRF event archive was found. The observation JSON template contains nulls, not fabricated data. No external data request or message was sent.

## Interaction validation

`npm run test:ui` executes the real compiled Angular bundle in jsdom with explicitly local-only forecast fixtures. It checks tab navigation, all ten initialization buttons, the hourly slider, soil/moisture/duration selectors, and download names. It does not test pixel layout. A native Chromium run was attempted but blocked by runtime socket permissions; no browser visual-approval claim is made. The PDF report was rendered and visually inspected.
