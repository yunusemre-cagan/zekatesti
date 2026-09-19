/**
 * Metin ve/veya görselden oluşan içeriği gösterir (şıklar, hız görevi uyaranları, lejant).
 *
 * Görseller `public/questions/...` altından servis edilir. Soru görselleri farklı boyutlarda
 * olabildiği için `Image` yerine düz `img` kullanılır ve boyut CSS ile sınırlanır; böylece
 * her görsel için genişlik/yükseklik girmek gerekmez.
 *
 * Kullanım: Tüm soru tipi bileşenleri ve sonuç ekranı.
 */
import type { Media } from "@/lib/questions/schema";

export interface MediaContentProps {
  media: Media;
  /** Görselin en büyük yüksekliğini belirleyen Tailwind sınıfı. */
  imageClassName?: string;
}

export function MediaContent({ media, imageClassName = "max-h-28" }: MediaContentProps) {
  return (
    <span className="flex flex-col items-center gap-2">
      {media.image !== undefined && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.image} alt="" className={`${imageClassName} w-auto object-contain`} />
      )}
      {media.text !== undefined && <span>{media.text}</span>}
    </span>
  );
}
