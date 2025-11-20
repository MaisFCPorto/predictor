'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import AdminGate from '../_components/AdminGate'

const API = process.env.NEXT_PUBLIC_API_BASE!
type Team = { id: string; name: string; short_name?: string; crest_url?: string }

export default function Teams() {
  const [list, setList] = useState<Team[]>([])
  const [f, setF] = useState<Team>({ id: '', name: '', short_name: '', crest_url: '' })
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await axios.get(`${API}/api/admin/teams`)
    setList(data)
  }
  useEffect(() => { load() }, [])

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 1500) }

  const create = async () => {
    await axios.post(`${API}/api/admin/teams`, f)
    setF({ id: '', name: '', short_name: '', crest_url: '' })
    notify('Criado ✅'); load()
  }
  const update = async (t: Team) => {
    await axios.patch(`${API}/api/admin/teams/${t.id}`, t)
    notify('Atualizado ✅'); load()
  }
  const del = async (id: string) => {
    if (!confirm('Apagar equipa e fixtures relacionadas?')) return
    await axios.delete(`${API}/api/admin/teams/${id}`)
    notify('Apagado ✅'); load()
  }

  return (
    <AdminGate>
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <title>+Predictor - Admin Equipas</title>
        <h1 className="text-2xl font-bold">Teams</h1>

        <div className="flex gap-2 items-center">
          <input className="border px-2 py-1 rounded w-32" placeholder="id" value={f.id}
                 onChange={e => setF({ ...f, id: e.target.value })} />
          <input className="border px-2 py-1 rounded w-64" placeholder="name" value={f.name}
                 onChange={e => setF({ ...f, name: e.target.value })} />
          <input className="border px-2 py-1 rounded w-28" placeholder="short_name" value={f.short_name}
                 onChange={e => setF({ ...f, short_name: e.target.value })} />
          <input className="border px-2 py-1 rounded w-[420px]" placeholder="crest_url" value={f.crest_url}
                 onChange={e => setF({ ...f, crest_url: e.target.value })} />
          <button className="border rounded px-3 py-1" onClick={create}>Create</button>
        </div>

        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2">ID</th>
              <th className="p-2">Name</th>
              <th className="p-2">Short</th>
              <th className="p-2">Crest URL</th>
              <th className="p-2 w-28"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(t => (
              <tr key={t.id} className="border-t">
                <td className="p-2">{t.id}</td>
                <td className="p-2">
                  <input className="border px-2 py-1 rounded w-full" defaultValue={t.name}
                         onBlur={e => update({ ...t, name: e.target.value })} />
                </td>
                <td className="p-2">
                  <input className="border px-2 py-1 rounded w-28" defaultValue={t.short_name}
                         onBlur={e => update({ ...t, short_name: e.target.value })} />
                </td>
                <td className="p-2">
                  <input className="border px-2 py-1 rounded w-full" defaultValue={t.crest_url}
                         onBlur={e => update({ ...t, crest_url: e.target.value })} />
                </td>
                <td className="p-2">
                  <button className="text-red-600" onClick={() => del(t.id)}>Apagar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
      </main>
    </AdminGate>
  )
}
