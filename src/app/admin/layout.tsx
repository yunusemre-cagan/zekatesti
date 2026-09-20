/**
 * Admin bölümünün ortak düzeni.
 *
 * Giriş sayfası dışındaki tüm admin sayfaları için oturum kontrolü burada yapılır; oturum
 * yoksa /admin/login adresine yönlendirilir. Böylece her sayfada aynı kontrolü tekrarlamak
 * gerekmez. (Giriş sayfası bu layout'un altında olduğu için kendi kontrolünü yapar ve
 * yönlendirme döngüsü oluşmaması adına burada yol kontrolü yapılmaz: /admin/login zaten
 * oturumsuz erişilebilir olmalıdır.)
 *
 * Kullanım: /admin ve altındaki tüm sayfalar.
 */
import Link from "next/link";
import { IS_WRITE_ENABLED } from "@/lib/config";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
        <Link href="/admin" className="font-medium">
          Soru Yönetimi
        </Link>
        <span className="text-sm text-zinc-500">
          {IS_WRITE_ENABLED ? "Yerel geliştirme" : "Salt okunur (production)"}
        </span>
      </header>
      {children}
    </div>
  );
}
