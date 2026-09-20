/**
 * Yeni soru ekleme sayfası (/admin/questions/new).
 *
 * Oturum ve yazma izni kontrolü sunucuda yapılır; yazma kapalıysa (production) form
 * gösterilmez, çünkü kaydetme zaten reddedilirdi.
 *
 * Kullanım: Admin listesindeki "Yeni soru" bağlantısı.
 */
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/admin/auth";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { IS_WRITE_ENABLED } from "@/lib/config";

export const metadata = { title: "Admin — Yeni Soru" };
export const dynamic = "force-dynamic";

export default async function NewQuestionPage() {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }

  if (!IS_WRITE_ENABLED) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">
        <p className="text-zinc-600 dark:text-zinc-400">
          Bu ortamda soru eklenemez. Projeyi yerelde çalıştırın.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4">
      <h1 className="text-xl font-medium">Yeni soru</h1>
      <QuestionForm mode="create" />
    </main>
  );
}
