'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // se já estiver autenticado, vai direto para /admin
  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace('/admin')
      } else {
        setLoading(false)
      }
    }
    check()

    // mantém sessão atualizada (não é obrigatório, mas ajuda em dev)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) router.replace('/admin')
    })
    return () => { sub.subscription.unsubscribe() }
  }, [router])

  const signInWithGoogle = async () => {
    // <<< sem redirectTo >>>
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      // options: { redirectTo: window.location.origin }  // <- NÃO usar
    })
  }

  if (loading) {
    return (
      <main className="h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">A carregar…</p>
      </main>
    )
  }

  return (
    <main className="h-screen flex items-center justify-center">
      <title>+Predictor - Login</title>
      <div className="flex flex-col items-center gap-4 border rounded-xl p-8">
        <h1 className="text-2xl font-bold">Entrar</h1>
        <button
          onClick={signInWithGoogle}
          className="border rounded px-4 py-2 hover:bg-gray-50"
        >
          Entrar com Google
        </button>
      </div>
    </main>
  )
}
