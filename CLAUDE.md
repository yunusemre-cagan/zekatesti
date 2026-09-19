@AGENTS.md

# Proje Kuralları

1. **Kod açıklamaları zorunlu.** Her dosya, fonksiyon ve önemli kod bloğunun içine şunları anlatan açıklama yaz:
   - Kodun ne işe yaradığı
   - Projede nerede kullanıldığı
2. **İş yükü UI'dan ayrı.** İş mantığı (hesaplama, veri işleme, veri erişimi, doğrulama vb.) UI bileşenlerinin içinde yazılmaz. Ayrı modüllere (ör. `lib/`, servisler, hook'lar) konur; UI bileşenleri yalnızca bunları çağırır ve sonucu gösterir.
