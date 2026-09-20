/**
 * Admin giriş sayfası (/admin/login).
 *
 * Zaten giriş yapılmışsa panele yönlendirir. ADMIN_PASSWORD tanımlı değilse formu göstermek
 * yerine nasıl tanımlanacağını anlatır.
 *
 * Kullanım: /admin adresine giriş yapmadan gelen kullanıcılar buraya yönlendirilir.
 */
import { redirect } from "next/navigation";
import { isAdminConfigured, isAuthenticated } from "@/lib/admin/auth";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = { title: "Admin Girişi" };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAuthenticated()) {
    redirect("/admin");
  }

  if (!isAdminConfigured()) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 p-4">
        <h1 className="text-xl font-medium">Admin paneli kapalı</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Paneli açmak için proje kökündeki <code>.env.local</code> dosyasına
          <code className="mx-1 rounded bg-zinc-200 px-1 dark:bg-zinc-800">ADMIN_PASSWORD</code>
          ekleyip geliştirme sunucusunu yeniden başlatın.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-4">
      <h1 className="text-xl font-medium">Admin Girişi</h1>
      <LoginForm />
    </main>
  );
}
