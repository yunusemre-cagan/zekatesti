# IQ Test Uygulaması

Kullanıcıların üyelik gerektirmeden IQ testi çözüp sonucunu gördüğü bir web uygulaması.
Sorular yerel bir JSON dosyasında tutulur, görseller `public/` klasöründen servis edilir ve
puanlama tamamen sunucuda yapılır.

Mimari kararların gerekçeleri için bkz. [PLAN.md](PLAN.md).

---

## Hızlı başlangıç

```bash
npm install
cp .env.example .env.local   # ADMIN_PASSWORD değerini doldurun
npm run dev                  # http://localhost:3000
```

Gereksinim: Node.js 20.9 veya üzeri.

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu. Admin paneli yalnızca burada soru kaydedebilir. |
| `npm run build` | Production build |
| `npm run start` | Production build'i çalıştırır |
| `npm run lint` | ESLint kontrolü |
| `npm run typecheck` | TypeScript tip kontrolü |
| `npm test` | Birim ve API testleri (Vitest) |
| `npm run images` | Soru görsellerini (SVG) yeniden üretir |

---

## Testin işleyişi

1. **`/`** — Tek butonlu açılış ekranı. Üyelik veya giriş yoktur.
2. **`/test`** — Aktif sorular kolaydan zora sırayla, her ekranda bir soru gösterilir.
   Sorular arasında ileri geri gezilebilir. İlerleme `sessionStorage`'a yazıldığı için sayfa
   yenilense de test kaldığı yerden devam eder.
3. **`/result`** — Tahmini IQ, kategori dökümü, soru bazında süre ve çözüm açıklamaları.

**Süre:** Geri sayım yoktur; her sorunun süresi ayrı ölçülür ve toplam süre bunların
toplamıdır. Harcanan süre puanı etkiler (aşağıya bakınız). Testin açık unutulmasına karşı
görünmeyen 45 dakikalık bir emniyet sınırı vardır; bu süre dolarsa test o ana kadarki
cevaplarla gönderilir.

### Puanlama

Her soru **0–1 arası doğruluk puanı** alır ve bu puan iki katsayıyla çarpılır:

- **Zorluk ağırlığı:** Kolay 1, orta 2, zor 3. Zor sorular sonuca daha çok etki eder.
- **Hız çarpanı:** `beklenen süre / harcanan süre`, en fazla 1, en az 0.5. Beklenen süre
  zorluğa göre belirlenir (45 / 75 / 120 saniye) ve soru bazında `expectedSec` ile
  değiştirilebilir. Hız görevlerinde ve bellek sorusunun gösterim süresinde uygulanmaz.
  Bir soruda en fazla 5 dakika kaydedilir.

**Şans düzeltmesi:** Çoklu seçim ve hız görevlerinde yanlış işaretler puan düşürür; boş
bırakmak nötrdür. Katsayılar, rastgele veya "hepsini işaretle" taktiğiyle beklenen puanın
sıfır olacağı şekilde seçilmiştir. Soru puanı hiçbir zaman negatife düşmez.

**IQ dönüşümü:** Ağırlıklı başarı oranı, ortalaması 100 ve standart sapması 15 olan
dağılıma göre tam sayıya çevrilir ve 70–145 aralığına sınırlanır. Gerçek norm verisi
bulunmadığı için dönüşüm, [`src/lib/config.ts`](src/lib/config.ts) içindeki iki varsayıma
dayanır; katılımcı verisi toplandığında yalnızca o değerlerin güncellenmesi yeterlidir.

---

## Soru ekleme ve düzenleme

Sorular [`data/questions.json`](data/questions.json) dosyasında tutulur. İki yol vardır:

### 1. Admin paneli (önerilen)

```bash
npm run dev
```

`http://localhost:3000/admin` adresine gidip `.env.local` içindeki `ADMIN_PASSWORD` ile
giriş yapın. Panelden soru ekleyebilir, düzenleyebilir, pasife alabilir, silebilir ve görsel
yükleyebilirsiniz. Kaydedilen her soru şemaya göre doğrulanır; hatalı veri dosyaya yazılmaz.

> **Önemli:** Yazma işlemleri yalnızca yerel geliştirmede açıktır. Vercel'de çalışma anında
> dosya sistemi kalıcı olmadığı için panel production'da salt okunurdur. Akış şudur:
> yerelde ekle → `git commit` → `git push` → Vercel otomatik yeniden deploy eder.

### 2. JSON dosyasını elle düzenleme

`data/questions.json` doğrudan düzenlenebilir. Değişiklikten sonra:

```bash
npm test
```

Testler dosyanın şemaya uygunluğunu ve referans verilen tüm görsellerin `public/` altında
bulunduğunu kontrol eder.

### Soru görselleri

Görseller `public/questions/<soru-kimliği>/` altında durur. Mevcut matris, uzamsal ve katlama
sorularının görselleri [`scripts/generate-question-images.mjs`](scripts/generate-question-images.mjs)
tarafından üretilir; kural değişirse `npm run images` ile hepsi yeniden oluşturulur.
Kendi görselinizi admin panelinden de yükleyebilirsiniz (SVG, PNG, JPG, WEBP, GIF; en fazla 2 MB).

---

## Veri şeması

Şemanın tek kaynağı [`src/lib/questions/schema.ts`](src/lib/questions/schema.ts) dosyasıdır.

**Tüm sorularda ortak alanlar**

| Alan | Açıklama |
|---|---|
| `id` | Küçük harf, rakam ve tire (ör. `matris-01`). Görsel klasörünün adı da budur. |
| `type` | `single_choice`, `multi_choice`, `memory_sequence`, `speed_task` |
| `category` | Sonuç ekranındaki kategori dökümünü belirler |
| `difficulty` | 1 (kolay), 2 (orta), 3 (zor) |
| `prompt` | Soru metni |
| `promptImage` | İsteğe bağlı soru görseli (`/questions/...`) |
| `expectedSec` | İsteğe bağlı; beklenen çözüm süresi |
| `explanation` | Sonuç ekranında gösterilen çözüm açıklaması |
| `active` | `false` ise soru teste dahil edilmez |

**Tipe özel alanlar**

| Tip | Alanlar |
|---|---|
| `single_choice` | `options[]`, `correctOptionId` |
| `multi_choice` | `options[]`, `correctOptionIds[]` |
| `memory_sequence` | `sequence[]` (tek karakterli öğeler), `itemDisplayMs`, `transform` (`same`/`reverse`/`sorted`) |
| `speed_task` | `timeLimitSec`, `options[]` (tüm maddeler için ortak), `items[]`, isteğe bağlı `legend[]` |

Her şık metin, görsel veya ikisini birden içerebilir.

---

## Proje yapısı

```
src/
  app/                      # Sayfalar ve API route'ları
    api/test/               # start (soruları verir) ve submit (puanlar)
    api/admin/              # Oturum, soru CRUD, görsel yükleme
    admin/                  # Admin paneli sayfaları
  components/               # Arayüz bileşenleri (quiz, result, admin)
  hooks/                    # React'e bağlayan hook'lar (oturum, sayaçlar)
  lib/
    config.ts               # Süre ve puanlama ayarları
    questions/              # Şema, repository, etiketler, cevap temizleme
    scoring/                # Cevap kontrolü, hız çarpanı, IQ, test puanlama
    test/                   # Oturum durumu, süre, saklama, cevap şeması
    admin/                  # Kimlik doğrulama, form taslağı, yükleme kuralları
data/questions.json         # Soru veritabanı
public/questions/           # Soru görselleri
scripts/                    # Görsel üretici
```

**İki ilke:**

- **Doğru cevaplar tarayıcıya gönderilmez.** `/api/test/start` soruları cevapları çıkarılmış
  halde döner; puanlama yalnızca sunucuda yapılır.
- **İş mantığı arayüzden ayrıdır.** Hesaplama, doğrulama ve veri erişimi `lib/` altındaki saf
  modüllerdedir; bileşenler bunları çağırıp sonucu gösterir.

---

## Deploy (Vercel)

1. Depoyu GitHub'a push edin.
2. Vercel'de **New Project** → bu depoyu seçin. Next.js otomatik algılanır, ek ayar gerekmez.
3. Ortam değişkeni ekleyin: `ADMIN_PASSWORD` (admin panelini açmak için; panel production'da
   salt okunurdur).
4. Deploy edin.

Soru eklemek için yerelde çalışıp değişiklikleri push etmeniz yeterlidir; Vercel her push'ta
yeniden deploy eder.

---

## Testler

```bash
npm test
```

Kapsanan başlıklar: soru şeması kuralları, JSON repository (eşzamanlı yazma, bozuk veri,
salt-okunur mod), cevap değerlendirme ve şans düzeltmesi, hız çarpanı, IQ dönüşümü, test
oturumu ve süre ölçümü, cevapların tarayıcıya sızmaması, API route'ları ve gerçek soru
verisinin bütünlüğü.
