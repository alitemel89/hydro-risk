# HydroRisk · Ege

Owner-private interactive hydrological screening Site. Angular 20 + Leaflet frontend, Cloudflare Worker API, existing D1 area/monitor storage. The prior NestJS/PostGIS development services remain in this repository. The external `alitemel89/hydro-risk` GitHub repository was accessible but empty on 8 October 2026; implementation continues from the existing private Site source repository.

## Run and verify

```
npm ci
npm run build:hosted
npm test
```

The hosted bundle is `dist/server/index.js`, with `.openai/hosting.json` and the preserved D1 migration directory under `dist/.openai/`. Source must be committed and pushed to the Site's configured private repository before deployment. Do not change Site audience or publish this repository to GitHub without user authorization.

## Interactive analysis

`GET /api/basins` returns four actual river basin geometries: Gediz, Küçük Menderes, Büyük Menderes, Kuzey Ege. Source: Türkiye Ministry of Agriculture and Forestry TATUS MapServer layer 11, downloaded 2026-10-08, generalized at 0.002 degrees. These are natural drainage boundaries and can extend beyond administrative Ege provinces. Preserve source attribution. They are not manually invented basin outlines.

`POST /api/analysis` accepts either `{lat,lng}` for a 1 km² local analysis cell inside Ege land, or `{basinId}`. Optional parameters are `soilGroup` A–D, `wetness` dry/normal/wet, `ks` mm/h and `wrf`. Point cells are not upstream drainage basins. No parcel-scale or channel flood depth is calculated.

ECMWF IFS HRES is explicitly requested as `ecmwf_ifs` from the Open-Meteo ECMWF endpoint, approximately 9 km grid. Liquid precipitation includes convective showers: `max(0, precipitation - snowfall/7)` (mm total precipitation, cm snowfall per Open-Meteo definitions). Snowmelt is not modeled. Seventy-two future hourly interval ends, precipitation/snowfall units and proximity to the requested coordinates are checked. Missing data fails closed. A location uses one grid point; basins use up to nine distributed interior samples with approximate area weights. Each weather cell is combined with the same sampled land-cover mixture; local weather/cover correlation and full raster zonal statistics are not resolved. No fake forecasts or automatic substitution of another weather model is used.

CORINE 2018 is sampled at inside points of a 9×9 regular lattice. Cos(latitude) accounts approximately for geographic cell area. One ArcGIS multipoint query obtains the actual containing CORINE polygons. Point-in-polygon with ring parity handles holes. Missing coverage above 5%, incomplete service responses, or modelable land below 50% prevent analysis. Water, wetlands, snow and unsupported classes are excluded; coverage and modeled land area are displayed. Samples are approximate fractions, not exact clipped polygon areas. CORINE has 25 ha minimum mapping units and 100 m minimum widths.

The primary runoff and percolation results share one water balance. For each cover class, its assumed directly connected impervious fraction sends all rain directly to runoff; the pervious fraction uses Green-Ampt with analytically integrated ponded infiltration, explicit transition to ponding, and five-minute time steps. Infiltration is capped by rainfall and empty saturated storage. Water above field capacity drains at the selected maximum percolation rate. Initial storage can drain even when forecast rain is zero. ET, groundwater flow, snowmelt and routing are omitted. This is a simplified field-capacity drainage bucket, not the full HEC-HMS SMA model. Soil/imperviousness parameters are scenario assumptions requiring calibration.

SCS-CN is an independent cross-check, computed separately per CORINE cover class and spatial rainfall sample before weighting. It uses lambda=0.2, average antecedent runoff condition and six-hour dry event separation. Average CN is informational; runoff is not computed by applying this average CN to rainfall. The Green-Ampt moisture selector does not change CN antecedent condition. CN runoff is never subtracted from the Green-Ampt water balance.

Each hour's previous 24-hour rainfall and primary surface runoff are compared with uncalibrated screening thresholds 25/50/75 mm and 10/25/50 mm respectively. The first exceedance and maximum 72-hour level are displayed. Eight-hour-old results cannot display current no-exceedance. The open page refreshes every 30 minutes. This is screening, not official warning, calibrated flood probability, discharge, inundation extent or safety assurance. MGM official warning links are provided.

WRF is optional user-supplied JSON: `{source, hourly:[{time: ISO UTC, rain: mm}, ...72]}`. Timestamps must exactly match ECMWF intervals, rain must be finite and nonnegative, and a source string is required. It is displayed as a complementary scenario, never silently replaces ECMWF. The downloadable template contains null rainfall, not fabricated WRF values. Source provenance and spatial representativeness cannot be authenticated by this prototype.

The frontend and backend provide a public-data browser fallback for cloud network errors: returned fixed ECMWF/CORINE query URLs are retrieved by the browser and submitted to the owner-private API, with the same coordinate/unit/time validation. No API keys are present in the frontend. Backend memory caching is at most fifteen minutes. Existing D1 monitors and their previously authorized schedule are preserved; the new analysis view describes only its own open-page refresh behavior.

## Tests

The automated suite covers reference CN values, distributed CN vs mean-CN nonlinearity, Green-Ampt ponding, zero/intense rainfall, impervious surface sensitivity, percolation and storage water conservation, warning thresholds, real basin area sanity, point location validation, CORINE missing/holes/transfer limits, spatial rainfall weights, live-shaped API integration, WRF validation, SQLite persistence and the compiled Worker static assets. Actual CORINE and ECMWF responses were also exercised during delivery. Test data never becomes production forecast data.

## İzmir 2024 event research

The Site now includes a historical event laboratory for 11 September 2024 Menderes: station rainfall correction with 19 training days / 12 date blocks and a two-day event holdout; 10 ECMWF 49R1 hindcast initializations; and 36 soil/moisture/duration sensitivity scenarios using actual CORINE sampling. Multiplicative corrections did not beat identity in grouped validation; no rainfall coefficient is applied live. The archive is explicitly labeled hindcast, physical runoff/percolation calibration is pending real observations, and actual flood lead time remains unknown. GET `/api/history` returns the audited study. See [research/izmir-2024/README.md](research/izmir-2024/README.md) for datasets, QC caveats and reproducibility.

## Haritada alan seçimi
Konum, resmî havza veya Alan çiz modu ile analiz yapılır. Alan çiz modunda en az üç köşe seçip alan tamamlanır; kesişen sınırlar, Ege kara sınırları dışı ve 100 km² üzeri alanlar reddedilir. CORINE düğmesi hesapta kullanılan renkli örnek noktalarını gösterir; gerçek parsel sınırı değildir. Akarsu düğmesi yerel OSM su yollarını mavi gösterir; kayıt yokluğu su yolu olmadığı anlamına gelmez. Görünüm düğmeleri eşik hesabını değiştirmez.

## 15 Ekim 2026 · İstanbul kapsamı

- İstanbul ilinin kara sınırları eklendi; nokta ve en çok 100 km² polygon analizinde İstanbul ile Ege desteklenir. Ege’nin mevcut dört havzası korunur; İstanbul yerel dere havzaları henüz yoktur.
- Kağıthane, Ayamama çevresi, Beykoz ve Şile yalnızca referans konumlardır; yaşanmış veya doğrulanmış sel olayları olarak sunulmaz.
- 72 saatlik gerçek ECMWF + CORINE işleme yolu İstanbul’da da kullanılır. 1 ve 3 saatlik en yüksek model yağışı, saat sonu zamanlarıyla verilir. Kaba grid yerel kentsel sağanakları kaçırabilir; yeni kalibre edilmemiş olasılık puanı eklenmedi.
- İki saatten eski sonuç/pencere başlangıcı ve süresi dolmuş sonuçlar güncel gösterilmez; saat değişiminde eski yağış önbelleği yeniden kullanılmaz.
- Drenaj / kanal kapasitesi, gözlenmiş toprak nemi, yerel kalibrasyon ve taşkın olasılığı henüz yoktur.
- İstanbul sınırı: https://github.com/ttezer/turkiye-harita-verisi/blob/master/dist/geojson/provinces.geojson ; MIT lisansı worker/istanbul.mjs içinde korunur. Veri alma: 2026-10-15.

## 18 Ekim 2026 · İstanbul havza analizi

İstanbul'da Havza sekmesi üç yerel dere drenaj havzasını (Ayamama, Kağıthane, Alibey Haliç kolu; MERIT Hydro türetimi / resmî değil) ve yedi Bakanlık içme suyu havzasını ayrı gruplarda sunar. Kaynak, sınır niteliği, çıkış hücresi ve GeoJSON indirme arayüzde bulunur. Ege'nin dört ana havzası korunur. Yağış örneklemesi ve CORINE hesabı tüm seçili havza üzerinde yürür; il sınırıyla kırpılmaz. Baraj işletmesi veya kanal taşma hesabı eklenmedi. Veri üretimi, lisans, geometri kontrolleri ve canlı kaynak kontrolü `research/istanbul-basins/README.md` içindedir.

## 18 Ekim 2026 · Akarsu katmanı zaman aşımı düzeltmesi

Tarayıcının tek Overpass sunucusuna doğrudan isteği kaldırıldı; katman aynı kaynaktaki `/api/rivers` üzerinden çalışır. Sunucu iki bağımsız Overpass kaynağını sırayla, süre ve yanıt sınırıyla dener. Küçük alanlarda (çevreleyen kutu en fazla 2 km²) doğrudan OSM map JSON kaynağı son yedektir; bu durumda 1 km çevre tamponunun olmadığı kullanıcıya belirtilir. Geçerli yanıtlar Cloudflare edge önbelleğinde 10 dakika saklanır; eksik/hatalı yanıtlar saklanmaz. Katmanı kapatma veya konum değiştirme bekleyen isteği iptal eder; eski istek yeni seçimi değiştiremez. Zaman aşımı Türkçe açıklama ve tekrar deneme düğmesiyle ele alınır.

İki Overpass kaynağı canlı denemede yanıt vermezken Kağıthane çevresindeki küçük OSM map isteği 2 gerçek su yolu döndürdü; aynı yanıt üretim dönüşüm kodundan geçirildi. Dış kaynakların gelecekteki erişilebilirliği garanti edilmez. 47 test ve DOM etkileşim kontrolleri geçti.
