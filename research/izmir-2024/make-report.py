import json, math
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from xml.sax.saxutils import escape

root=Path(__file__).resolve().parent
out=root/'results'
s=json.loads((out/'study.json').read_text())
c=s['calibration'];runs=[r for r in s['runs'] if r['stationId']=='maydanoz']
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9,'axes.spines.top':False,'axes.spines.right':False,'axes.edgecolor':'#dbe5e1','axes.labelcolor':'#4a666d','xtick.color':'#607a80','ytick.color':'#607a80','figure.facecolor':'white','axes.facecolor':'white'})
fig,ax=plt.subplots(figsize=(7.7,2.55));ax.bar(range(10),[r['eventMaxRain24'] for r in runs],color=['#087f82' if r['eventLevel'] else '#a8c9cc' for r in runs],width=.65)
for t,color in [(25,'#b4a576'),(50,'#c48c63'),(75,'#b47872')]:ax.axhline(t,color=color,linestyle='--',linewidth=.8,label=f'{t} mm eşiği')
ax.set_ylabel('Olay penceresinde maks. 24 sa. sıvı yağış (mm)');ax.set_xticks(range(10),[r['issue'][5:10]+'\n'+r['issue'][11:16] for r in runs]);ax.set_xlabel('Yeniden tahmin başlangıcı · UTC');ax.legend(loc='upper left',ncols=3,frameon=False,fontsize=8);fig.tight_layout();fig.savefig(out/'hindcast-rain.png',dpi=180);plt.close(fig)

fig,axes=plt.subplots(1,2,figsize=(7.7,3.65));scenarios=s['sensitivity'];labels=[f'{g} / {w}' for g in 'ABCD' for w in ['kuru','normal','ıslak']]
for ax,key,title,maxval in [(axes[0],'runoff','Yüzey akışı · mm',127.8),(axes[1],'percolation','Perkolasyon · 72 sa. / mm',240)]:
 arr=np.array([[next(x['summary'][key] for x in scenarios if x['soilGroup']==g and x['wetness']==w and x['duration']==d) for d in [6,12,24]] for g in 'ABCD' for w in ['dry','normal','wet']]);im=ax.imshow(arr,vmin=0,vmax=maxval,cmap='YlGnBu',aspect='auto');ax.set_title(title,pad=10);ax.set_xticks(range(3),['6 sa.','12 sa.','24 sa.']);ax.set_yticks(range(12),labels);ax.tick_params(axis='both',length=0)
 for y in range(12):
  for x in range(3):ax.text(x,y,f'{arr[y,x]:.1f}',ha='center',va='center',fontsize=7,color='white' if arr[y,x]>maxval*.6 else '#31545b')
fig.tight_layout();fig.savefig(out/'hydrology-sensitivity.png',dpi=180);plt.close(fig)

pdfmetrics.registerFont(TTFont('DV','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DV-Bold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
pdfmetrics.registerFontFamily('DV',normal='DV',bold='DV-Bold')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleTR',fontName='DV-Bold',fontSize=24,leading=31,textColor=HexColor('#315e63'),spaceAfter=16))
styles.add(ParagraphStyle(name='HeadTR',fontName='DV-Bold',fontSize=15,leading=21,textColor=HexColor('#315e63'),spaceAfter=12))
styles.add(ParagraphStyle(name='BodyTR',fontName='DV',fontSize=9.4,leading=15.5,textColor=HexColor('#4d666e'),spaceAfter=10))
styles.add(ParagraphStyle(name='SmallTR',fontName='DV',fontSize=8,leading=12.5,textColor=HexColor('#73868c'),spaceAfter=8))
styles.add(ParagraphStyle(name='CellTR',fontName='DV',fontSize=8.4,leading=12,textColor=HexColor('#4d666e')))
styles.add(ParagraphStyle(name='LabelTR',fontName='DV-Bold',fontSize=8,leading=13,textColor=HexColor('#819790'),spaceAfter=9))
story=[]
def p(t,style='BodyTR'):return Paragraph(t,styles[style])
def add(t,style='BodyTR'):story.append(p(t,style))
def table(rows,widths):
 t=Table([[p(str(x),'CellTR') for x in r] for r in rows],colWidths=widths,hAlign='LEFT',repeatRows=1)
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#eaf2ef')),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('LINEBELOW',(0,0),(-1,-1),.4,HexColor('#e1e9e5'))]));story.append(t);story.append(Spacer(1,12))
def image(name,width=475):
 im=ImageReader(str(out/name));iw,ih=im.getSize();story.append(Image(str(out/name),width=width,height=width*ih/iw));story.append(Spacer(1,10))
def page():story.append(PageBreak())
def fmt(x,n=2):return f'{x:.{n}f}'.replace('.',',')

add('HYDRORISK · OLAY ARAŞTIRMASI · 8 EKİM 2026','LabelTR')
add('11 Eylül 2024<br/>İzmir / Menderes','TitleTR')
add('Yağış düzeltmesi ve geçmiş erken uyarı deneyi','HeadTR')
add('<b>Sonuç:</b> Yağış düzeltme deneyi ve ECMWF yeniden tahmin eşik testi gerçekleştirildi. Veriler, fiziksel akış/perkolasyon kalibrasyonunu veya olay öncesi gerçek operasyonel erken uyarı süresini doğrulamak için yeterli değil.')
table([['Çalışma','Uygulama','Bulgusu'],['Gözleme dayalı yağış düzeltmesi',f'{c["trainCount"]} gün / {c["trainBlocks"]} blok eğitim; olayın 2 günü test','Doğrulamada ham tahmin en iyi. Yeni katsayı uygulanmadı.'],['Geçmiş eşik testi','10 ECMWF başlangıcı; Maydanoz ve havaalanı noktaları','Maydanoz’da 3 çalışmada eşik sinyali; operasyonel kayıt değil.'],['Hidrolojik duyarlılık','4 toprak × 3 nem × 3 süre = 36 senaryo','Belirsizlik geniş; ölçüm olmadan doğru parametre seçilemez.']],[140,155,180])
add('Olayın gözlemsel dayanağı','HeadTR')
add('İzmir Büyükşehir Belediyesi 11 Eylül kaydında Menderes için 24 saatte 127,8 mm yağış ve Ahmetbeyli / Maydanoz çevresinde su baskını ve yol hasarı bildiriyor. Yağış istasyonu, 24 saatin bitiş saati ve kesin taşkın başlangıcı verilmemiştir. Bu toplam Maydanoz’a ölçüm veya havza ortalaması olarak atanmadı. [1]')
add('Adnan Menderes havaalanı ayrı bir kontrol noktasıdır. NOAA GSOD’de 11 ve 12 Eylül için tam günlük toplamlar bulunur; kıyıdaki olay yerini temsil ettiği varsayılmaz. [4, 5]')
add('Özel çalışma URL’si: <link href="https://hydro-risk.aylintemel-de.chatgpt.site">hydro-risk.aylintemel-de.chatgpt.site</link><br/>Sitede “2024 olay testi” sekmesi, model başlangıç seçimi, saat kaydırıcısı, 36 senaryo ve JSON/CSV indirme bulunur.','SmallTR')

page();add('A · Yağış düzeltme deneyi','TitleTR')
add('Hedef ve zaman eşleştirmesi','HeadTR')
add('İstasyon 17219099999; arşiv konumu 38,292392° K / 27,156953° D. Hedef, GSOD G bayraklı tek 24 saatlik toplamdır. İnç × 25,4 dönüşümü uygulandı. Eksik / kısmi A–F, H, I ve 99,99 günlük hedef olarak kullanılmadı. ISD’de aynı tarihteki tekil 24 saatlik toplam (QC 1/5) ±0,14 mm içinde eşleşince aralık sonu alındı. Eksikler sıfır yapılmadı.')
add('<b>Bayrak sınırı:</b> Yağışlı ISD kayıtlarında koşul kodu 3, birikim başlangıcı olarak tanımlanıyor. Bu yüzden ISD tek başına güvenilir hedef kabul edilmedi. GSOD G toplamı ile ISD zaman eşleştirmesi koşullu kullanıldı. İki ürün aynı üst veriden türetilir; bağımsız iki ölçüm değildir. MGM ham kayıtlarıyla teyit gerekir. [4, 5]')
add('Eğitim ve doğrulama','HeadTR')
add('15 Mart–9 Eylül döneminin 19 eşleşen günü, 48 saatten büyük aralıkta yeni blok açılarak 12 gruba ayrıldı. Bir bloğu dışarıda bırakıp kalan bloklarda katsayı hesaplayan doğrulama kullanıldı. 11–12 Eylül’ün iki günü aynı olay olarak tüm eğitim ve yöntem seçiminden ayrıldı.')
table([['Yöntem','Çarpan','Blok doğrulaması RMSE'],*[[{'identity':'Ham tahmin','massRatio':'Toplam oranı','leastSquares':'En küçük kareler'}[x['method']],fmt(x['factor'],3),fmt(x['crossValidation']['rmse'])+' mm'] for x in c['candidates']]],[200,90,185])
add('İki günlük olay testi · 06 UTC / 09 TR aralık sonu','HeadTR')
test=[x for x in c['pairs'] if x['end']>='2024-09-10']
table([['Aralık sonu','Gözlem (GSOD)','Yeniden tahmin'],*[[x['end'][:10]+' 09:00 TR',fmt(x['observed'])+' mm',fmt(x['predicted'],1)+' mm'] for x in test]],[200,135,140])
add(f'<b>Test RMSE: {fmt(c["testRaw"]["rmse"])} mm.</b> Katsayı 1,000 seçildi; yeni düzeltme yapılmadı. Bir çarpan fırtınanın konumunu veya zamanını düzeltemez. 19 günlük eksik ve seçilmiş örnek tüm mevsimin doğrulaması değildir. İki gün tek olaydır; bölgesel başarı yüzdesi çıkarılamaz. Güncel ECMWF sürümüne aktarım yapılmadı.')

page();add('B · Geçmiş uyarı eşik testi','TitleTR')
add('<b>Arşiv kökeni:</b> Open-Meteo, 14 Mart 2024’ten başlayan seriyi IFS 49R1 hindcast olarak tanımlıyor. 49R1’in operasyonel uygulaması 12 Kasım 2024’tür. Eylül verileri o gün dağıtılmış operasyonel tahminler olarak kabul edilemez. [2, 3]')
add('Başlangıç + 6 saat, varsayımsal erişim kesimidir. Model hesabı ve dağıtım gecikmesini temsil eder; gerçek yayın zaman kaydı değildir. Bu saatten sonraki 72 tam saat kullanıldı. Tam gözlem günü, ancak erişim gözlem aralığının başlangıcından önceyse karşılaştırıldı. Daha sonraki çalışmalara tam günlük puan atanmadı.')
image('hindcast-rain.png')
table([['Başlangıç · UTC','Vars. erişim · UTC','Olay maks. 24 sa.','Eşik'],*[[r['issue'][5:16].replace('T',' '),r['availability'][5:16].replace('T',' '),fmt(r['eventMaxRain24'],1)+' mm',['Yok','Dikkat','Yüksek','Çok yüksek'][r['eventLevel']]] for r in runs]],[120,135,110,110])
add('Üç sinyal, bir olaya ait 10 model başlangıcının sonuçlarıdır; “%30 taşkın yakalama başarısı” değildir. Başlangıçlar arasında sinyal değişiyor. Operasyonel 48R1 dosyaları ve kesin taşkın başlangıcı olmadan doğrulanmış erken uyarı süresi verilemez.','SmallTR')

page();add('C · Hidrolojik duyarlılık','TitleTR')
add('Menderes için bildirilen 127,8 mm, Maydanoz’un 1 km² hücresine varsayımsal ve homojen uygulanmıştır. 6 / 12 / 24 saatlik düzgün yağış dağılımları sentetiktir. Bunlar ölçülmüş saatlik yağış veya drenaj havzası değildir.')
add('CORINE 2018 örneklemesinde modellenen kara yaklaşık %72,8’dir. Bu kara içinde geçiş orman/çalılık %57,6 ve karma tarım %42,4’tür. Kıyı hücresindeki su/desteklenmeyen örtü dışarıda tutulur. CORINE’nin 25 ha ölçeği küçük kent parçalarını ve 2024 yapılaşmasını tam temsil etmeyebilir. [9]')
image('hydrology-sensitivity.png')
add('Su dengesi ve yorum','HeadTR')
add('Green-Ampt infiltrasyonu ve tarla kapasitesi deposu, 5 dakikalık alt adımlarla çalışır. Geçirimsiz örtü akışa doğrudan katkı yapar. <b>Yağış = yüzey akışı + perkolasyon + depo değişimi.</b> Tüm 36 senaryoda sayısal fark 0,000001 mm’den küçüktür.')
add('Senaryo aralığı: yüzey akışı yaklaşık 0–109,0 mm; 72 saatlik perkolasyon 0–227,8 mm. Bunlar olasılık veya güven aralığı değildir. Islak başlangıçta depo boşaldığı için perkolasyon yağıştan büyük olabilir; negatif depo değişimi bunu dengeler. Perkolasyon akifer beslenmesi ölçümü değildir.')
add('Toprak Ks, emme, başlangıç nemi ve drenaj hızlarını bir taşkın haberiyle tekil olarak belirlemek mümkün değildir. Debi/seviye gözlemi ve yerel drenaj sınırı olmadan NSE/KGE, tepe debi, taşkın yayılımı veya fiziksel parametre kalibrasyonu raporlanmadı.')

page();add('D · Tam kalibrasyon için veriler','TitleTR')
table([['Kayıt','Kullanımı / mevcut sınır'],*[[x['data'],x['purpose']+'. '+x['status']] for x in s['missingData']]],[185,290])
add('Doğrulamanın bulduğu yazılım düzeltmesi','HeadTR')
add('Önceki canlı prototip Open-Meteo “rain” alanını kullanıyordu; bu alan konvektif sağanağı dışarıda bırakır. Yeni hesap “precipitation − snowfall / 7” ile sıvı yağışı kullanır; mm/cm ve eksik bileşenler doğrulanır. Kar erimesi hesaplanmaz. [8]')
add('10 Eylül 00 UTC Maydanoz yeniden tahmininde 06–06 UTC aralığı için geniş ölçekli rain 0,4 mm, sağanak dahil sıvı yağış 28,1 mm’dir. Bu fark, kalibrasyon çarpanıyla gizlenmek yerine veri değişkeni seçiminde düzeltildi.')
add('Teslim edilenler','HeadTR')
add('Özel sitede iki çalışma, model başlangıç seçimi, saat kaydırıcısı, 36 senaryo seçimi, ham/kalibrasyon karşılaştırması ve boş gözlem şablonu bulunur. Araştırma paketi eşleştirilmiş günleri, geçmiş çalışma sonuçlarını, senaryoları, kaynak URL/hash manifestini ve yeniden üretim betiklerini içerir. Gerçek gözlem yerine yapay veri eklenmedi.')
add('Temel hesaplar, eksik veri reddi, sağanak/kar ayrımı, eğitim-test ayrımı, erişim zaman kesimi, senaryo su dengesi ve okuma API’si otomatik testlerle doğrulandı. Ekran seçicileri derlenmiş Angular uygulamasının DOM entegrasyon testinde doğrulandı. Tam tarayıcı / görsel ekran testi, çalışma ortamının socket izni nedeniyle yürütülemedi. Fiziksel kalibrasyon ve operasyonel erken uyarı doğrulaması yukarıdaki gerçek kayıtlarla tamamlanabilir.','SmallTR')

page();add('Kaynaklar ve yeniden üretim','TitleTR')
for i,src in enumerate(s['sources'],1):
 add(f'<b>[{i}] {escape(src["label"])}</b><br/><link href="{escape(src["url"])}">{escape(src["url"])}</link>','SmallTR')
add('Veri erişimi: 8 Ekim 2026. Olay tarihleri ve model kökeni ayrı tutulmuştur. Yöntemler mevcut HydroRisk Green-Ampt / depo ve SCS-CN kontrol hesabını kullanır. Yağış çarpan adayları: k = Σ(P·O)/Σ(P²) ve k = ΣO/ΣP; kimlik k = 1 de adaydır. Aday seçimi yalnız eğitim bloklarının doğrulama RMSE’sine dayanır.','SmallTR')
add('Yeniden üretim: extract-observations.py → fetch-inputs.mjs → run-study.mjs. Kaynak API yanıtları ve SHA-256 manifesti araştırma paketindedir. Tüm eşleştirme ve eleme kuralları research/izmir-2024/README.md dosyasında açıklanır.','SmallTR')
def footer(canvas,doc):
 canvas.setFont('DV',7);canvas.setFillColor(HexColor('#82948f'));canvas.drawString(48,28,'HydroRisk · İzmir 2024 · Özel araştırma');canvas.drawRightString(548,28,str(doc.page))
doc=SimpleDocTemplate(str(out/'hydrorisk-izmir-2024-rapor.pdf'),pagesize=(595.28,841.89),leftMargin=60,rightMargin=60,topMargin=45,bottomMargin=48,title='HydroRisk – İzmir 2024 olay araştırması',author='HydroRisk')
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(out/'hydrorisk-izmir-2024-rapor.pdf')
