/**
 * Teste girecek soruların belirlenmesi ve sıralanması.
 *
 * Karar (PLAN.md → "Alınan Kararlar"): Her testte tüm aktif sorular sorulur.
 * Sorular kolaydan zora sıralanır; aynı zorluktaki sorular veri dosyasındaki sıralarını korur.
 * Böylece soru sırası her katılımcı için aynıdır ve sonuçlar karşılaştırılabilir kalır.
 */
import type { Question } from "@/lib/questions/schema";

/** Aktif soruları kolaydan zora sıralanmış olarak döner. Girdi dizisini değiştirmez. */
export function getTestQuestions(questions: readonly Question[]): Question[] {
  // `toSorted` kararlı (stable) sıralama yapar: eşit zorluktaki sorular dosya sırasını korur.
  return questions.filter((q) => q.active).toSorted((a, b) => a.difficulty - b.difficulty);
}
