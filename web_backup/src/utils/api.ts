const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

export async function savePrediction({
    userId,
    fixtureId,
    home,
    away,
  }: {
    userId: string;
    fixtureId: string;
    home: number;
    away: number;
  }) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/predictions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, fixtureId, home, away }),
    });
  
    if (!res.ok) {
      throw new Error(`Erro ao guardar palpite (${res.status})`);
    }
  }
  
