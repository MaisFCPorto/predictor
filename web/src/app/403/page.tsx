// apps/web/src/app/403/page.tsx
export default function ForbiddenPage() {
    return (
      <main className="mx-auto max-w-xl p-8 text-center">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <h1 className="text-2xl font-semibold">Acesso negado</h1>
          <p className="mt-2 text-white/70">Não tens permissões para aceder a esta área.</p>
        </div>
      </main>
    );
  }