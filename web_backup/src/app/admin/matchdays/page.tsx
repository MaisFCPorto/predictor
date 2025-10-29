'use client'
import { useEffect, useState } from 'react'
import axios from 'axios'
import AdminGate from '../_components/AdminGate'

const API = process.env.NEXT_PUBLIC_API_BASE!
type MD = { id: string; season_id: string; name: string; starts_at: string; ends_at: string }

export default function Matchdays() {
  const [list, setList] = useState<MD[]>([])
  const [f, setF] = useState<MD>({
    id: '', season_id: 'ucl-25', name: '',
    starts_at: '2025-10-20 18:00:00', ends_at: '2025-10-23 23:59:00'
  })
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await axios.get(`${API}/api/admin/matchdays`)
    setList(data)
  }
  useEffect(() => { load() }, [])
  const notify = (m:string)=>{ setMsg(m); setTimeout(()=>setMsg(''),1500) }

  const create = async () => {
    await axios.post(`${API}/api/admin/matchdays`, f)
    setF({ ...f, id: '', name: '' }); notify('Criado ✅'); load()
  }
  const update = async (m: MD) => {
    await axios.patch(`${API}/api/admin/matchdays/${m.id}`, m)
    notify('Atualizado ✅'); load()
  }
  const del = async (id: string) => {
    if (!confirm('Apagar matchday e fixtures?')) return
    await axios.delete(`${API}/api/admin/matchdays/${id}`)
    notify('Apagado ✅'); load()
  }

  return (
    <AdminGate>
      <main className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Matchdays</h1>

        <div className="grid grid-cols-6 gap-2">
          <input className="border px-2 py-1 rounded" placeholder="id" value={f.id}
                 onChange={e => setF({ ...f, id: e.target.value })} />
          <input className="border px-2 py-1 rounded" placeholder="season_id" value={f.season_id}
                 onChange={e => setF({ ...f, season_id: e.target.value })} />
          <input className="border px-2 py-1 rounded col-span-2" placeholder="name" value={f.name}
                 onChange={e => setF({ ...f, name: e.target.value })} />
          <input className="border px-2 py-1 rounded" placeholder="starts_at" value={f.starts_at}
                 onChange={e => setF({ ...f, starts_at: e.target.value })} />
          <input className="border px-2 py-1 rounded" placeholder="ends_at" value={f.ends_at}
                 onChange={e => setF({ ...f, ends_at: e.target.value })} />
          <div className="col-span-6">
            <button className="border rounded px-3 py-1" onClick={create}>Create</button>
          </div>
        </div>

        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2">ID</th><th className="p-2">Season</th>
              <th className="p-2">Name</th><th className="p-2">Start</th><th className="p-2">End</th><th className="p-2 w-28"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(m => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{m.id}</td>
                <td className="p-2">
                  <input className="border px-2 py-1 rounded w-28" defaultValue={m.season_id}
                         onBlur={e => update({ ...m, season_id: e.target.value })} />
                </td>
                <td className="p-2">
                  <input className="border px-2 py-1 rounded w-64" defaultValue={m.name}
                         onBlur={e => update({ ...m, name: e.target.value })} />
                </td>
                <td className="p-2">
                  <input className="border px-2 py-1 rounded w-48" defaultValue={m.starts_at}
                         onBlur={e => update({ ...m, starts_at: e.target.value })} />
                </td>
                <td className="p-2">
                  <input className="border px-2 py-1 rounded w-48" defaultValue={m.ends_at}
                         onBlur={e => update({ ...m, ends_at: e.target.value })} />
                </td>
                <td className="p-2">
                  <button className="text-red-600" onClick={() => del(m.id)}>Apagar</button>
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
