/**
 * Kategori ve soru tiplerinin kullanıcıya gösterilen Türkçe adları.
 *
 * Veride İngilizce, sabit anahtarlar tutulur (ör. "numeric_pattern"); ekranda gösterilecek
 * metinler burada eşlenir. `Record<...>` kullanıldığı için şemaya yeni bir kategori
 * eklendiğinde burada karşılığı yazılmazsa TypeScript derleme hatası verir.
 *
 * Kullanım: Sonuç ekranındaki kategori dökümü ve admin panelindeki açılır listeler.
 */
import type { MemoryTransform, QuestionCategory, QuestionType } from "./schema";

export const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  numeric_pattern: "Sayısal Örüntü",
  visual_matrix: "Görsel Matris",
  logical_deduction: "Mantıksal Çıkarım",
  verbal_analogy: "Sözel Analoji",
  spatial_reasoning: "Uzamsal Düşünme",
  working_memory: "Çalışma Belleği",
  problem_solving: "Problem Çözme",
  processing_speed: "İşlemleme Hızı",
  odd_one_out: "Farklı Olanı Bul",
  coding_decoding: "Şifre Çözme",
  cube_folding: "Küp Açınımı",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Tek doğru şık",
  multi_choice: "Birden fazla doğru şık",
  memory_sequence: "Bellek dizisi",
  speed_task: "Süreli eşleştirme",
};

export const MEMORY_TRANSFORM_LABELS: Record<MemoryTransform, string> = {
  same: "Aynı sırayla",
  reverse: "Tersten",
  sorted: "Küçükten büyüğe sıralayarak",
};
