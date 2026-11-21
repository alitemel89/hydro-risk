# HydroRisk — Sites v19 kaynak dışa aktarımı

Bu paket, yayındaki HydroRisk Sites v19 sürümünün **3c7888f430d5f4e6ff7f7bbc017f6d92606d3f58** commit'inden alınmıştır. Yayın kaydı ve dosya bazında SHA-256 karşılaştırmaları `SOURCE_EXPORT_MANIFEST.json` içindedir. Dışa aktarımda çalışan Site değiştirilmedi ve yeniden yayımlanmadı.

## İçerik

- `apps/web`: Angular 20 / Leaflet; harita, konum, alan çizimi, havza seçimi, katmanlar, arayüz ve stiller.
- `worker`: yayındaki Cloudflare Worker backend; ECMWF, CORINE, yağış doğrulama, Green-Ampt / depo / SCS-CN, havzalar, akarsular ve API uçları.
- `apps/api`: korunmuş NestJS/PostGIS geliştirme backend'i. Yayındaki analiz uçlarını Worker sağlar; NestJS servisinin tek başına çalıştırılması yayındaki tam analiz servisi yerine geçmez.
- `database`, `db`, `drizzle`, `libs`: PostGIS / D1 şemaları, migration'lar ve ortak doğrulama.
- `research`: İstanbul/Ege havza verileri, İstanbul 2026 ve İzmir 2024 deneyleri; çalıştırılabilir araştırma kodları, girdiler, sonuçlar, raporlar ve kaynak kayıtları.
- `tests`, `scripts`, `.github`, `.openai`: testler, derleme/CI ve Sites bağlama yapılandırmaları.
- `package.json`, `package-lock.json`, `angular.json`, `nx.json`, TypeScript ve Compose yapılandırmaları.

## Kurulum ve kontrol

Node.js 22.12+ veya 24 ve npm kullanın. Bağımlılıklar pakete dahil değildir; kilit dosyası korunmuştur.

```bash
npm ci
npm exec tsc -- -p apps/api/tsconfig.json
npm run build:hosted
npm test
npm run test:ui
node research/istanbul-2026/verify-hosted.mjs
```

Üretim Worker çıktısı `dist/server/index.js` olur; `.openai/hosting.json` ve D1 migration'ları korunmuştur. Bu işlemler yalnızca yerel derleme ve testtir; yayına göndermez. `npm run build` Nx kısa yoludur; bu ortamda Nx grafik işlemi çalışmadığı için ayrı derleyici komutlarıyla doğrulama yapıldı. Ayrıntılar `TEST_RESULTS.json` içindedir.

NestJS/PostGIS geliştirme servisi için `.env.example` dosyasını `.env` olarak kopyalayın, kendi `POSTGRES_PASSWORD` ve `DATABASE_URL` değerlerinizi yerel olarak girin ve ortam değişkenlerini süreçlere aktarın. Parolalar bu pakette boş bırakılmıştır. Ardından Compose veritabanını, migration'ları ve `npm run dev:api` / `npm run dev:web` komutlarını kullanabilirsiniz. Üretim D1 verileri ve runtime gizli değerleri kaynak kod değildir; dışa aktarılmadı.

## Taşınabilirlik ve gizli bilgi temizliği

Orijinal 152 Git girdisinden makineye özel `node_modules` symlink'i çıkarıldı. Diğer 151 dosya dahil edildi; yalnızca üç dosyada uyarlama yapıldı: `.env.example` ve `compose.yaml` içindeki örnek parolalar çıkarıldı; İstanbul testi Git geçmişi yerine kaydedilmiş SHA-256 değerleriyle yerel kaynakları doğrular hale getirildi. Uygulama ve hidrolojik motor dosyaları orijinaliyle byte düzeyinde aynıdır.

`.git`, bağımlılık klasörleri, derleme çıktıları, önbellekler, gerçek `.env` dosyaları, erişim anahtarları ve şifreler dahil değildir. Yayındaki Sites kimliği `.openai/hosting.json` içinde kaynak yapılandırması olarak korunmuştur; kimlik bir erişim anahtarı değildir. Bu dosyayı kullanarak Site'yi otomatik yayımlayan bir işlem çalıştırmayın.

Kaynak içindeki eski README tarihsel geliştirme notlarını da içerir; v19 için güncel dışa aktarım kapsamı bu dosyada ve manifesttedir. Kaynak veri lisansları/atıfları korunmuştur. Model kalibre edilmiş bir taşkın olasılığı veya doğrulanmış erken uyarı hizmeti olarak sunulmaz.
