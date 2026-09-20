/**
 * Soru düzenleme sayfası (/admin/questions/[id]).
 *
 * Soru sunucuda okunur ve forma taslak olarak verilir. Kimlik değiştirilemez (form alanı
 * kilitlidir ve API de farklı kimliği reddeder).
 *
 * Kullanım: Admin listesindeki "Düzenle" bağlantısı.
 */
import { notFound, redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/admin/auth";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { questionToDraft } from "@/lib/admin/draft";
import { IS_WRITE_ENABLED } from "@/lib/config";
import { questionRepository } from "@/lib/questions/repository";

export const metadata = { title: "Admin — Soru Düzenle" };
export const dynamic = "force-dynamic";

export default async function EditQuestionPage({ params }: PageProps<"/admin/questions/[id]">) {
  if (!(await isAuthenticated())) {
    redirect("/admin/login");
  }

  const { id } = await params;
  const question = await questionRepository.getById(id);
  if (question === undefined) {
    notFound();
  }

  if (!IS_WRITE_ENABLED) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">
        <p className="text-zinc-600 dark:text-zinc-400">
          Bu ortamda sorular düzenlenemez. Projeyi yerelde çalıştırın.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4">
      <h1 className="text-xl font-medium">
        Soru düzenle: <code className="text-base">{question.id}</code>
      </h1>
      <QuestionForm mode="edit" initialDraft={questionToDraft(question)} />
    </main>
  );
}
