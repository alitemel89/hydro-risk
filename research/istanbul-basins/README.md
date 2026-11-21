# İstanbul havzaları · 18 Ekim 2026

Bu veri ürününde üç **türetilmiş dere drenaj havzası** ve yedi **Bakanlık içme suyu havzası** ayrı tutulur. Hiçbiri taşkın yayılım alanı veya kalibre edilmiş taşkın olasılığı haritası değildir.

## Yerel dere havzaları

MERIT Hydro v1.0.1 akış yönü verisinin SUEN-HAB tarafından açık dağıtılan Türkiye bölümü kullanıldı. 3 yay-saniyelik (~90 m) D8 ağına ters yönde yürünerek seçilen çıkış hücresine ulaşan tüm üst hücreler toplandı. Alanlar İstanbul il sınırıyla kesilmedi.

- Ayamama: modeldeki derenin son kara hücresi; geodezik sınır alanı yaklaşık 68,41 km².
- Kağıthane: modelde Alibey koluyla ilk birleşim öncesindeki doğu kolu; yaklaşık 176,72 km².
- Alibey: aynı birleşimin batı kolu, barajı ve aşağı kesimi içerir; yaklaşık 194,46 km².

Bunlar arazi ölçümü veya resmî dere havzası sınırları değildir. Çıkış noktaları ve belirsizlikler GeoJSON özelliklerinde kayıtlıdır. Ayamama için literatürdeki 72 km² değeri ile aynı büyüklük mertebesindedir; bu bir kalibrasyon veya sınır doğrulaması sayılmaz. Kağıthane’de literatüre göre alan farkı vardır; küresel topoğrafya, çıkış seçimi ve kapalı kentsel drenaj belirsizliği korunur. Alibey baraj alanının yaklaşık %98,7’si türetilmiş dere havzasıyla örtüşür; iki sonuç toplanamaz.

### Lisans ve atıf

`istanbul-derived-basins.geojson` ve aynı üç türetilmiş özellik, MERIT Hydro çift lisansı içinden **ODbL 1.0** seçilerek yayımlanır. Kaynak ülke rasteri yeniden dağıtılmaz. İndirilebilir türetilmiş veri Site'de `/data/istanbul-dere-havzalari.geojson` adresindedir. Bakanlık özellikleri bu yeniden lisanslamaya dahil değildir; kendi kaynak atıflarını taşır.

- MERIT Hydro © Yamazaki vd. (2019), https://doi.org/10.1029/2019WR024873
- Veri ve lisans: https://global-hydrodynamics.github.io/MERIT_Hydro/
- Akış yönü dağıtımı ve georeferans: https://hab.suen.gov.tr/
- Seçilen lisans: https://opendatacommons.org/licenses/odbl/1-0/
- Hidrolojik çıkarım ve türetilmiş veri: Hydro Risk, 2026-10-18.

### Tekrarlanabilir üretim

Python ile numpy, shapely, rasterio ve pyproj kurulu olmalı. Bu ön işleme uygulama açılışında veya Site build'inde çalışmaz.

```bash
python research/istanbul-basins/prepare-flow.py
python research/istanbul-basins/index-flow.py
python research/istanbul-basins/derive-basins.py
python research/istanbul-basins/build-catalog.py
```

İlk iki dosyanın SHA-256 özetleri `raw/flow-window-metadata.json` içindedir. Toplam 5.534.881 pencere hücresinde döngü bulunmadı. Üç havzanın hiçbiri pencere kenarına değmiyor; yukarı havza kırpılmadı. Hücre sayıları akış birikimi ile eşleşiyor, çıkış hücreleri sınırın içinde, son geometriler geçerli. Küçük topoloji koruyan sadeleştirmenin alan değişimi %0,1'in altında. Sayısal detaylar `derived-validation.json` içindedir.

## İçme suyu havzaları

Kaynak: Tarım ve Orman Bakanlığı, SYGM İçme Suyu Havza Sınırları katmanı:
https://cbs1.tarimorman.gov.tr/server/rest/services/SYGM/icme_suyu_havza_sinirlari/MapServer/0

18 Ekim 2026 tarihinde İstanbul çevresi zarfına kesişim sorgusu yapıldı; geometri **zarfa veya il sınırına kırpılmadı**. Kaynak ID'leri 1,2,3,4,6,8,9 seçilerek Terkos, Sazlıdere, Alibeyköy, Büyükçekmece, Elmalı-II, Darlık, Ömerli alındı. Kaynakta iki halkada kendine temas vardı; `make_valid` ile alan değişmeden onarıldı. Onarım nedeni ve sadeleştirme kontrolü `source-validation.json` içindedir. Geodezik alanlar kaynak geometri üzerinden hesaplandı, resmî yayımlanmış alan değeri olarak etiketlenmedi.

Bu sınırlar baraj/göl su toplama alanlarıdır. Baraj salımları, rezervuar depolaması, güncel yağmursuyu şebekesi, kesit kapasitesi ve hidrolik yönlendirme bu sürümde hesaplanmaz.

## Uygulama doğrulaması

Her havzada iç örnekler ve yağış temsil noktalarının geometri içinde kalması ve ağırlık toplamının 1 olması test edilir. Ayamama, Kağıthane ve Ömerli'de güncel ECMWF ve CORINE yanıtlarıyla 72 saatlik hesap kontrol edildi; özet `live-validation.json` içindedir. Yanıtlar test verisi olarak canlı sisteme sabitlenmez; Site her analizde güncel veri kullanır. Buradaki kayıtlar yalnızca test anının kaynak kontrolüdür.
