'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { supabase } from '@/lib/supabaseClient'

export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const apply = async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        window.location.href = '/login'
        return
      }
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      // mantém atualizado quando o token refresca
      supabase.auth.onAuthStateChange(async (_evt, sess) => {
        const t = sess?.access_token
        if (t) axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
      })

      setReady(true)
    }
    apply()
  }, [])

  if (!ready) return <main className="p-6">A autenticar…</main>
  return <>{children}</>
}
