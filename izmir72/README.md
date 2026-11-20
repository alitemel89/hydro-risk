# HydroRisk İzmir72 — deneysel ECMWF yağış analizi

Bu klasör HydroRisk'in yayımlanmış haritalı sitesinden **ayrı**, FastAPI tabanlı bağımsız bir modüldür. ECMWF IFS model tahmininden 24, 48 ve 72 saatlik yağış toplamlarını ve saatlik seriyi gösterir. **Kalibre edilmiş taşkın riski/olasılığı ya da resmî uyarı sistemi değildir.**

## Çalıştırma

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
# http://127.0.0.1:8000
pytest -q
```

- `GET /` — Türkçe seçim paneli, grafik, JSON indirme
- `GET /health` — servis durumu
- `GET /api/places` — örnek İzmir noktaları
- `GET /api/forecast?lat=38.4237&lon=27.1428` — gerçek Open-Meteo ECMWF talebi (internet gerekir)

Kaynak: https://open-meteo.com/en/docs/ecmwf-api
Model: `ecmwf_ifs`, saatlik `precipitation,snowfall`, UTC. `precipitation` toplam su eşdeğeri mm; `snowfall` cm. Yaklaşık sıvı yağış = `max(0,precipitation-snowfall/7)`. İlk 72 tam gelecek saat doğrulanır; eksik/bozuk veride sonuç uydurulmaz, HTTP 503 döner. `model_run_verified=false` olduğundan model başlangıç zamanı operasyonel arşiv kaydı olarak doğrulanmamıştır.

Sınırlamalar: Tek noktanın yağış tahmini, havza toplamı değildir. Toprak, topoğrafya, akarsu kapasitesi, gerçek taşkın eşiği ve kalibrasyon bu modülde yoktur. Yerel birim testleri gerçek dış ağ bağlantısını doğrulamaz. Ticari dağıtımdan önce veri sağlayıcının lisans ve kullanım koşulları ayrıca kontrol edilmelidir. Resmî uyarı için MGM/AFAD takip edilmelidir.

**Entegrasyon durumu:** HydroRisk canlı sitesinin orijinal kaynakları bu depoda henüz bulunmuyor. Green-Ampt, SCS-CN, CORINE ve haritalı ana web uygulaması burada yer almıyor. Bu modül onların yerine geçtiği iddiasında değildir.
