/**
 * Admin ana sayfası (/admin): soru listesi.
 *
 * Sorular sunucuda okunur (repository) ve listelenir. Filtreleme, silme gibi etkileşimler
 * istemci bileşeni olan QuestionList içinde yapılır.
 *
 * Kullanım: Admin panelinin giriş noktası.
 */
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/admin/auth";
import { QuestionList } from "@/components/admin/QuestionList";
import { IS_WRITE_ENABLED } from "@/lib/config";
import { questionRepository } from "@/lib/questions/repository";
import { QuestionDataError } from "@/lib/questions/errors";

export const metadata = { title: "Admin — Sorular" };
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }

  let questions;
  try {
    questions = await questionRepository.getAll();
  } catch (error) {
    // Veri dosyası bozuksa panel çökmemeli; sorun kullanıcıya anlatılır.
    const message =
      error instanceof QuestionDataError
        ? "Soru dosyası okunamadı veya şemaya uymuyor. Sunucu günlüğündeki ayrıntıya bakın."
        : "Sorular yüklenirken beklenmeyen bir hata oluştu.";
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 p-4">
        <p className="text-red-600 dark:text-red-400">{message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4">
      {!IS_WRITE_ENABLED && (
        <p className="rounded-lg border border-amber-300 p-3 text-sm text-amber-800 dark:border-amber-800 dark:text-amber-300">
          Bu ortamda sorular değiştirilemez. Soru eklemek veya düzenlemek için projeyi yerelde
          çalıştırın (<code>npm run dev</code>), değişiklikleri commit&apos;leyip push edin.
        </p>
      )}
      <QuestionList questions={questions} canWrite={IS_WRITE_ENABLED} />
    </main>
  );
}
