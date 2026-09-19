/**
 * Soru deposuna (repository) ait hata sınıfları.
 *
 * Genel `Error` yerine özel sınıflar kullanılır; böylece API katmanı hatanın türüne göre
 * doğru HTTP durum kodunu seçebilir (ör. NotFound → 404, Duplicate → 409, ReadOnly → 403).
 */

/** Veri dosyası okunamadığında veya şemaya uymadığında fırlatılır. */
export class QuestionDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QuestionDataError";
  }
}

/** Belirtilen kimlikte soru bulunamadığında fırlatılır. */
export class QuestionNotFoundError extends Error {
  constructor(public readonly questionId: string) {
    super(`"${questionId}" kimlikli soru bulunamadı.`);
    this.name = "QuestionNotFoundError";
  }
}

/** Aynı kimlikte bir soru zaten varken yeni soru eklenmeye çalışıldığında fırlatılır. */
export class DuplicateQuestionIdError extends Error {
  constructor(public readonly questionId: string) {
    super(`"${questionId}" kimlikli bir soru zaten mevcut.`);
    this.name = "DuplicateQuestionIdError";
  }
}

/** Salt-okunur ortamda (production / Vercel) yazma denendiğinde fırlatılır. */
export class ReadOnlyRepositoryError extends Error {
  constructor() {
    super("Bu ortamda sorular değiştirilemez. Soru eklemek için projeyi yerelde çalıştırın.");
    this.name = "ReadOnlyRepositoryError";
  }
}
