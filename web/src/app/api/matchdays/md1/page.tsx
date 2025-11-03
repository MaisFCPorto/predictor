'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'

const API = process.env.NEXT_PUBLIC_API_BASE

export default function MatchdayPage() {
  const [fixtures, setFixtures] = useState<any[]>([])
  const [predictions, setPredictions] = useState<{ [id: number]: { home: string, away: string } }>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    axios.get(`${API}/api/matchdays/md1/fixtures`).then(res => setFixtures(res.data))
  }, [])

  const handleInput = (id: number, field: 'home' | 'away', value: string) => {
    setPredictions(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const handleSave = async (id: number) => {
    setSaving(id)
    setMessage('')
    const p = predictions[id] || { home: '0', away: '0' }
  
    try {
      await axios.post(`${API}/api/predictions`, {
        fixtureId: id,
        home: Number(p.home ?? 0),
        away: Number(p.away ?? 0),
        username: 'demo-user'
      })
      setMessage('Guardado com sucesso ✅')
    } catch (e: any) {
      console.error(e?.response?.data || e)
      setMessage('Falha ao guardar ❌')
    } finally {
      setSaving(null)
      setTimeout(() => setMessage(''), 2000)
    }
  }
  

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold mb-8">Matchday 1</h1>
      <div className="grid gap-6 w-full max-w-2xl">
        {fixtures.map(f => (
          <div key={f.id} className="bg-white p-6 rounded-2xl shadow flex items-center justify-between">
            <div className="flex-1 text-center">
              <p className="font-semibold">{f.home_team_name}</p>
              <input
                type="number"
                className="border rounded w-16 text-center"
                value={predictions[f.id]?.home || ''}
                onChange={e => handleInput(f.id, 'home', e.target.value)}
              />
            </div>
            <div className="px-2 text-gray-500 font-bold text-xl">vs</div>
            <div className="flex-1 text-center">
              <p className="font-semibold">{f.away_team_name}</p>
              <input
                type="number"
                className="border rounded w-16 text-center"
                value={predictions[f.id]?.away || ''}
                onChange={e => handleInput(f.id, 'away', e.target.value)}
              />
            </div>
            <button
              onClick={() => handleSave(f.id)}
              className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
              disabled={saving === f.id}
            >
              {saving === f.id ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        ))}
      </div>
      {message && <p className="text-green-600 mt-4">{message}</p>}
    </div>
  )
}
