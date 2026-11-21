# 14 Ekim 2026 İstanbul · ham model olay testi

Bu çalışma canlı v18 parametrelerini değiştirmeden, 13–15 Ekim olayını sınar. Sonuç bir fiziksel kalibrasyon veya doğrulanmış taşkın öngörü süresi değildir.

## Yeniden üretme

Node 24 yeterlidir. Sırasıyla:

1. `node research/istanbul-2026/fetch-observations.mjs`
2. `node research/istanbul-2026/fetch-inputs.mjs`
3. `node research/istanbul-2026/run-study.mjs`
4. `node research/istanbul-2026/render-page.mjs`
5. `node --test tests/istanbul-baseline.test.mjs`

MGM'nin herkese açık toplam yağış sayfasının kullandığı tarihli servisinden istasyon numarası, koordinat, zaman ve yağış alanları alınır. Ulusal yanıttan yalnızca İstanbul kayıtları tutulur. Sayfa bu ölçümlerin kalite kontrolünden geçmediğini belirtir. 24 saatlik pencere 06–06 UTC'dir (09–09 Türkiye). Günlük yağış saatlere dağıtılmaz.

Beş ölçüm noktası: Beykoz, Sarıyer, İTÜ Maslak, Eyüpsultan ve Arnavutköy. Cebeci ayrı bir gözlemsiz referans hücresidir; taşkın gözlemi olarak kullanılmaz. Belediye taleplerinin türleri karışıktır; taşkın yakalama/kaçırma ve yanlış alarm oranları bunlardan çıkarılmaz.

Ana değerlendirme kuralı sonuç görülmeden sabittir: gözlem penceresinin başlangıcından 30 saat önce başlatılmış ECMWF koşusu alınır. 6 saat dağıtım gecikmesi varsayımıyla, pencere başlangıcına 24 saat kala erişim demektir. İki ölçüm penceresi için 12 ve 13 Ekim 00 UTC koşuları kullanılır. Diğer koşular yalnızca koşu değişkenliği ve 72 saatlik eşik taramasını gösterir. Yinelenen tahminler bağımsız olay örnekleri sayılmaz.

Open-Meteo belgesine göre Mayıs 2026 sonrası IFS Cycle 50R1 kullanılır. Arşiv zaman damgası başlatma anıdır; gerçek dağıtım günlüğü elimizde değildir. Model 9 km gridini gösterir, nokta yağış ölçerini birebir temsil etmez.

Hidroloji canlı koddan `distributedHydrology` ile B/normal ve mevcut eşikler kullanılarak çalışır. Başlangıç +6 saatten sonraki tam 72 saat alınır. Kıyıdaki Beykoz ölçerinin 1 km² hücresinde desteklenen kara örtüsü yeterli olmadığından hidrolojik sonuç üretilmez; yağış doğrulaması yine geçerlidir. Bu dışlama açıkça raporlanır, başka konuma gizlice taşınmaz.

Kalibre edilmiş debi/seviye, taşkın yayılımı veya gerçek taşkın başlangıç saati yoktur. Eğitim/doğrulama için bağımsız olaylar ve yerel saatlik yağış ile debi/seviye kayıtları gerekir. Tek bu olaya göre katsayı ayarlanmadı.

Kaynak istekleri, ham yanıtlar ve SHA-256 kayıtları repo içinde korunur. İnceleme sayfası `/istanbul-2026.html`; JSON ve CSV de yayımlanır. Canlı model kodunun hashleri `results/study.json` içindedir.
