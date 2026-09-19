# IQ Test Uygulaması

Kullanıcıların üyelik gerektirmeden IQ testi çözüp sonucunu gördüğü, Next.js ile yazılmış basit bir web uygulaması.
Mimari ve kararlar için bkz. [PLAN.md](PLAN.md).

> Bu README proje ilerledikçe genişletilecektir (soru ekleme akışı, veri şeması, deploy adımları).

## Gereksinimler

- Node.js 20.9 veya üzeri

## Kurulum

```bash
npm install
cp .env.example .env.local   # ADMIN_PASSWORD değerini doldurun
npm run dev                  # http://localhost:3000
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Geliştirme sunucusu (admin paneli yalnızca burada soru kaydedebilir) |
| `npm run build` | Production build |
| `npm run start` | Production build'i çalıştırır |
| `npm run lint` | ESLint kontrolü |
| `npm run typecheck` | TypeScript tip kontrolü |
| `npm test` | Birim testleri (Vitest) |

## Teknolojiler

Next.js (App Router) · TypeScript (strict) · Tailwind CSS · Zod · Vitest
