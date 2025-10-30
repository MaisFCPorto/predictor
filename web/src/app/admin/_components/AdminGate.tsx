// apps/web/src/app/admin/_components/AdminGate.tsx
'use client'
import React from 'react'
import { supabaseBrowser } from '@/utils/supabase/client'

type State = 'checking' | 'no-session' | 'denied' | 'allowed'

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State>('checking')

  React.useEffect(() => {
    const run = async () => {
      try {
        const supabase = supabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setState('no-session'); return }

        // token pronto para chamadas protegidas (se precisares)
        const token = session.access_token
        // Example: podes guardar no axios default headers se usares axios
        // axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

        // verifica role no teu endpoint (se tiveres)
        // const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/admin/me`, { headers: { Authorization: `Bearer ${token}` } })
        // if (r.ok) setState('allowed'); else setState('denied')

        // por agora, se chegaste aqui e não tens checagem de role remota, permite:
        setState('allowed')
      } catch {
        setState('no-session')
      }
    }
    run()
  }, [])

  if (state === 'checking') {
    return <main className="p-6">A verificar permissões…</main>
  }

  if (state === 'no-session') {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="text-lg font-semibold mb-2">Sessão necessária</div>
          <p className="text-sm text-white/70 mb-4">Para aceder a esta área tens de iniciar sessão.</p>
          <a href="/auth" className="inline-block rounded-xl bg-white/15 px-4 py-2 text-sm font-medium hover:bg-white/20">
            Ir para login
          </a>
        </div>
      </main>
    )
  }

  if (state === 'denied') {
    return (
      <main className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="text-lg font-semibold">Acesso restrito</div>
          <p className="mt-2 text-sm text-white/70">
            Esta área é exclusiva para administradores. Se achas que é um erro, contacta um admin.
          </p>
        </div>
      </main>
    )
  }

  return <>{children}</>
}
