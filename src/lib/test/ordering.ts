/**
 * Teste girecek soruların belirlenmesi ve sıralanması.
 *
 * Karar (PLAN.md → "Alınan Kararlar"): Her testte tüm aktif sorular sorulur.
 *
 * İki kural birlikte uygulanır:
 *  1. Sorular kolaydan zora sıralanır.
 *  2. Peş peşe iki soru aynı kategoriden olmaz. Aksi halde kullanıcı arka arkaya dört matris
 *     sorusu çözüyor, hem sıkılıyor hem de o kategoride ısınmış olmanın avantajını kazanıyor.
 *
 * İkinci kural birinciyi gerektiği kadar esnetir: kategori tekrarı oluşacaksa sıradaki uygun
 * soru öne alınır, atlanan soru ilk fırsatta yerine konur. Böylece zorluk sırası korunur ama
 * kategori dağılımı garanti edilir.
 *
 * Kullanım: /api/test/start ve /api/test/submit route'ları, teste girecek soru listesini bununla belirler.
 */
import type { Question } from "@/lib/questions/schema";

/** Aktif soruları, kolaydan zora ve kategorileri ardışık gelmeyecek şekilde sıralar. */
export function getTestQuestions(questions: readonly Question[]): Question[] {
  // `toSorted` kararlı (stable) sıralama yapar: eşit zorluktaki sorular dosya sırasını korur.
  const byDifficulty = questions.filter((q) => q.active).toSorted((a, b) => a.difficulty - b.difficulty);
  return spreadCategories(byDifficulty);
}

/**
 * Sıralanmış listeyi, aynı kategoriden iki soru yan yana gelmeyecek biçimde yeniden dizer.
 *
 * Her adımda listenin başından itibaren, bir önceki sorudan farklı kategorideki **ilk** soru
 * seçilir. Bu, zorluk sırasından mümkün olan en küçük sapmayı yapar: yalnızca kategori
 * çakışması olduğunda bir soru öne alınır.
 *
 * Kalan soruların tamamı bir önceki soruyla aynı kategorideyse (ör. testte tek kategori varsa)
 * kural sağlanamaz; bu durumda sıra bozulmadan devam edilir.
 */
function spreadCategories(ordered: readonly Question[]): Question[] {
  const remaining = [...ordered];
  const result: Question[] = [];

  while (remaining.length > 0) {
    const previousCategory = result.at(-1)?.category;
    const index = remaining.findIndex((question) => question.category !== previousCategory);
    const [picked] = remaining.splice(index === -1 ? 0 : index, 1);
    result.push(picked!);
  }

  return result;
}

/**
 * Listede yan yana aynı kategoriden soru olup olmadığını söyler.
 * Testlerde ve veri bütünlüğü kontrolünde kullanılır.
 */
export function findAdjacentSameCategory(questions: readonly Question[]): string[] {
  return questions.flatMap((question, index) =>
    index > 0 && questions[index - 1]!.category === question.category
      ? [`${questions[index - 1]!.id} → ${question.id} (${question.category})`]
      : [],
  );
}
