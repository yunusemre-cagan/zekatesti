# IQ Test Uygulaması — Uygulama Planı

Kullanıcıların siteye girip IQ testini çözdüğü ve sonucunu gördüğü basit, hızlı bir web uygulaması.
Üyelik/giriş yoktur. Sorular yerel bir JSON veritabanında, görseller `public/` klasöründe tutulur.
Proje Vercel'e deploy edilecektir.

---

## 0. Alınan Kararlar

| Konu | Karar |
|---|---|
| Admin kalıcılığı | **Seçenek A** — Admin paneli yalnızca yerelde (`npm run dev`) yazar. Akış: yerelde soru ekle → `git push` → Vercel otomatik yeniden deploy eder. Production'da admin paneli salt-okunurdur. |
| Test uzunluğu | Her seferinde **tüm aktif sorular** sorulur. |
| Soru sırası | Kolaydan zora; ayrıca peş peşe aynı kategoriden soru gelmez (zorluk sırası bunun için en fazla bir seviye esnetilir). |
| Açılış ekranı | Tek butonlu ("Teste Başla") sade bir açılış. |
| Süre ölçümü | Geri sayım yok. Süre **soru bazında** ölçülür, toplam süre bunların toplamıdır. Görünmeyen 45 dakikalık emniyet sınırı vardır. |
| Sürenin puana etkisi | **Belirleyici.** Her sorunun puanı hız çarpanıyla çarpılır. |
| Sekme arka plandayken | Sayaç **işlemeye devam eder**. |
| Yorum dili | Kod içi açıklamalar Türkçe, değişken/fonksiyon isimleri İngilizce. |

### Neden Seçenek A?
Vercel'de çalışma anında dosya sistemi kalıcı değildir; production'da JSON'a veya `public/`
klasörüne yazılan veri kaybolur. Bu nedenle yazma işlemleri yalnızca yerel geliştirme ortamında
yapılır. Sorular git ile versiyonlanır ve sorumlu kişi tarafından doğrudan incelenebilir.
Depolama katmanı `QuestionRepository` arayüzü arkasında soyutlandığı için ileride uzak bir
veritabanına (Turso / Vercel Postgres + Blob) geçiş tek bir dosyanın değiştirilmesiyle mümkündür.

---

## 1. Teknoloji Seçimi

- **Next.js 16 (App Router) + TypeScript (strict)** — Vercel'e sıfır konfigürasyonla deploy; arayüz ve API aynı projede.
- **Veritabanı:** `data/questions.json` — okunabilir git diff'i, ek servis gerektirmez.
- **Zod** — Soru şemasının tek doğruluk kaynağı: TS tipleri, admin form doğrulaması ve JSON okuma kontrolü buradan türetilir.
- **Tailwind CSS** — Minimal, temiz bir arayüz için.
- **Vitest** — Puanlama ve cevap kontrolü gibi saf fonksiyonların birim testleri.
- **Görseller:** `public/questions/<soru-id>/...`. Hazırlanan matris ve uzamsal soru görselleri **SVG** olacaktır.

---

## 2. Klasör Yapısı

```
src/
  app/
    page.tsx                  # Açılış: tek "Teste Başla" butonu
    test/page.tsx             # Quiz akışı
    result/page.tsx           # Sonuç ekranı
    admin/                    # Admin paneli (liste, ekle, düzenle)
    api/
      test/start/route.ts     # Aktif soruları cevapları çıkarılmış halde döner
      test/submit/route.ts    # Cevapları sunucuda puanlar
      admin/...               # CRUD + görsel yükleme (yalnızca dev ortamında yazar)
  components/
    quiz/                     # QuestionRenderer, OptionGrid, Timer, ProgressBar
    quiz/types/               # Her soru tipi için ayrı bileşen
    admin/                    # QuestionForm, tipe göre dinamik alanlar, ImageUpload
  lib/
    config.ts                 # Test süresi, IQ dönüşüm parametreleri vb.
    questions/schema.ts       # Zod şemaları (tek doğruluk kaynağı)
    questions/repository.ts   # Okuma/yazma soyutlaması (JSON implementasyonu)
    questions/sanitize.ts     # İstemciye giden sorudan doğru cevabı çıkarır
    scoring/                  # Cevap kontrolü, puanlama, IQ tahmini (saf fonksiyonlar + testler)
    test/ordering.ts          # Sıralama: kolaydan zora + kategori dağılımı
data/questions.json
public/questions/
```

---

## 3. Veri Modeli

**Ortak alanlar:** `id`, `type`, `category`, `difficulty (1–3)`, `prompt`, `promptImage?`, `explanation?`, `active`.

Tipe özgü alanlar **discriminated union** ile modellenir:

| Tip | Ek alanlar | Cevap kontrolü |
|---|---|---|
| `single_choice` (sayısal örüntü, matris, mantık, analoji, problem çözme, ek tipler) | `options: {id, text?, image?}[]`, `correctOptionId` | Seçilen şık == doğru şık |
| `multi_choice` (uzamsal — "hangileri aynı cisim?") | `options`, `correctOptionIds[]` | Kısmi puan; yanlış işaret puan düşürür (şans düzeltmesi) |
| `memory_sequence` (çalışma belleği) | `sequence[]` (tek karakterlik öğeler), `itemDisplayMs`, `transform: 'reverse' \| 'same' \| 'sorted'` | Beklenen cevap sunucuda diziden hesaplanır |
| `open_answer` (açık uçlu) | `answerFormat`, `acceptedAnswers[]` | Normalize edilmiş cevap kabul edilenlerden biriyle aynı mı |
| `nback_task` (çalışma belleği) | `n`, `sequence[]`, `itemDisplayMs` | Kısmi puan; doğru işaretler − yanlış işaretler |
| `speed_task` (işlemleme hızı) | `timeLimitSec`, `legend?` (sembol→rakam anahtarı), `options[]` (tüm maddeler için ortak), `items[]` (`stimulus` + `correctOptionId`) | Kısmi puan; yanlış madde puan düşürür (şans düzeltmesi) |

Her şık metin, görsel veya ikisini birden içerebilir. Soru metnine de görsel eklenebilir.

---

## 4. Test Akışı

1. **`/`** — Kısa bir cümle ve "Teste Başla" butonu.
2. **`/api/test/start`** — Tüm aktif sorular kolaydan zora sıralanarak döner. **Doğru cevaplar istemciye asla gönderilmez.**
3. **`/test`** — Her ekranda tek soru, ilerleme çubuğu ve o soruda geçen süreyi gösteren yukarı sayan sayaç. Geri dönme ve soru atlama serbest; bir soruya dönülürse süreler toplanır. Durum `useReducer` ile yönetilir ve `sessionStorage`'a yedeklenir (sayfa yenilenince test kaybolmaz; sayfanın kapalı olduğu süre sayılmaz). Görünmeyen emniyet sınırına ulaşılırsa test otomatik gönderilir.
   - **Bellek sorusu:** Dizi elemanları sırayla gösterilir, ardından gizlenir ve cevap alanı açılır; dizi tekrar görüntülenemez.
   - **Hız görevi:** Soruya özel geri sayım; süre bitince görev otomatik tamamlanır.
4. **`/api/test/submit`** — Puanlama tamamen sunucuda yapılır.
5. **`/result`** — Tahmini IQ, doğru sayısı, kategori bazlı başarı, geçen süre, soru açıklamaları. "Klinik geçerliliği olmayan tahmini sonuçtur" uyarısı.

**Geçerlilik eşiği:** Soruların en az %60'ı cevaplanmamışsa IQ gösterilmez.

**Puanlama:** Her soru zorluğu kadar ağırlık alır (1/2/3) ve 0–1 arası puan alır. Ağırlıklı başarı
oranı, ortalaması 100 ve standart sapması 15 olan dağılıma göre IQ değerine çevrilir, 70–145
aralığında sınırlanır ve **her zaman tam sayı** olarak gösterilir. Dönüşüm parametreleri
`lib/config.ts` içinde tutulur.

**Hız çarpanı:** Her sorunun puanı `beklenen süre / harcanan süre` oranıyla çarpılır (en fazla 1,
en az 0.5). Beklenen süre zorluğa göre belirlenir (kolay 15 sn, orta 25 sn, zor 40 sn) ve soru
bazında `expectedSec` ile değiştirilebilir. İki istisna: hız görevleri (zaten kendi süre sınırı var)
ve bellek sorusunda dizinin gösterildiği süre. Bir soruda kaydedilen süre en fazla 5 dakikadır;
böylece test açık unutulursa tek bir soru tüm sonucu bozmaz.

**Şans düzeltmesi (kısmi puanlı sorular):** Çoklu seçim ve hız görevlerinde yanlış işaretler puan
düşürür; boş bırakmak ne kazandırır ne kaybettirir. Ceza katsayıları, rastgele veya garantici
(tüm şıkları işaretleyen) bir kullanıcının beklenen puanı sıfır olacak şekilde seçilmiştir:
çoklu seçimde `doğru şık sayısı / yanlış şık sayısı`, hız görevinde `1 / (şık sayısı − 1)`.
Soru puanı hiçbir zaman negatife düşmez.

---

## 5. Admin Paneli (`/admin`)

- `ADMIN_PASSWORD` ortam değişkeni ile basit şifre koruması (httpOnly cookie).
- **Liste:** Tip/kategoriye göre filtre, aktif/pasif yapma, silme.
- **Ekle / Düzenle:** Soru tipine göre değişen dinamik form, şık ekleme/çıkarma, doğru şıkkı işaretleme, görsel yükleme (`public/questions/<id>/` klasörüne), soruyu kullanıcının göreceği şekliyle önizleme.
- Kaydetmeden önce Zod doğrulaması; hatalı veri JSON'a yazılamaz.
- Production ortamında yazma işlemleri kapalıdır; "Soru eklemek için projeyi yerelde çalıştırın" bilgisi gösterilir.

---

## 6. Sorular (havuzda 54, testte aktif 39)

| # | Kategori | Adet | Not |
|---|---|---|---|
| 1 | Sayısal örüntü | 4 | Kare farkları, Fibonacci benzeri, iç içe diziler |
| 2 | Görsel matris (3×3) | 4 | SVG; şekil, dönme, sayı, dolgu kuralları |
| 3 | Mantıksal çıkarım | 4 | Sıralama, kıyas, "kesinlikle doğrudur" tipi |
| 4 | Sözel analoji | 4 | İşlev, parça-bütün, derece ilişkileri |
| 5 | Uzamsal düşünme | 4 | SVG izometrik cisimler ve rotasyonlar; bir kısmı çoklu seçim |
| 6 | Çalışma belleği | 3 | Tersten, aynı sırada, sıralayarak; artan uzunluk |
| 7 | Problem çözme | 3 | Birden fazla kuralın eşzamanlı uygulandığı özgün problemler |
| 8 | İşlemleme hızı | 2 | Sembol-rakam kodlama, benzer şekli bulma (8–10 madde, süreli) |
| 9 | **Ek öneriler** | 6 | Farklı olanı bul (2), Şifre çözme (2), Kağıt katlama (2) |
| 10 | **Zorluk artışı (sonradan eklendi)** | 8 | Açık uçlu sorular (3), n-back (1), şövalye-yalancı mantığı (1), üç kurallı matris (1), şekil serisi (1), ızgara bulmacası (1) |

Her soruya çözüm açıklaması (`explanation`) yazılacaktır.

---

## 7. Kod Kalitesi İlkeleri

- Zod şeması tüm tipler için tek kaynaktır; `any` kullanılmaz.
- İş mantığı (puanlama, sıralama, cevap kontrolü) React'ten bağımsız saf fonksiyonlardır ve birim testlidir.
- Depolama `QuestionRepository` arayüzü arkasındadır.
- Her modülün başında amacını anlatan açıklama bloğu, önemli fonksiyonlarda JSDoc, kritik kararlarda "neden" yorumları bulunur.
- README: kurulum, soru ekleme akışı, veri şeması, Vercel deploy adımları.

---

## 8. Uygulama Aşamaları

1. Proje kurulumu (Next.js, TS, Tailwind, Zod, Vitest, ESLint) + git
2. Şema + repository + birkaç örnek soru
3. Puanlama, sıralama, cevap temizleme + birim testleri
4. API route'ları (start / submit)
5. Quiz arayüzü: tüm soru tipi bileşenleri, zamanlayıcılar, sonuç sayfası
6. Admin paneli: şifre, CRUD, görsel yükleme, önizleme
7. 34 soru + SVG görselleri
8. Uçtan uca kontrol (tarayıcıda testin baştan sona çözülmesi), README, deploy hazırlığı
