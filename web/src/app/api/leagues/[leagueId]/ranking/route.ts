// src/app/api/leagues/[leagueId]/ranking/route.ts
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim();

/**
 * Helper para montar a base da API (Cloudflare Worker, etc.)
 */
function apiBase() {
  if (!API_BASE) return '';
  return API_BASE.replace(/\/+$/, '');
}

/**
 * Helper para sacar o leagueId a partir da URL:
 * /api/leagues/:leagueId/ranking
 */
function extractLeagueIdFromUrl(req: NextRequest): string | null {
  try {
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const idx = segments.indexOf('leagues');
    if (idx === -1 || idx + 1 >= segments.length) return null;
    return segments[idx + 1] || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const leagueId = extractLeagueIdFromUrl(req);

  if (!leagueId) {
    return NextResponse.json(
      { error: 'leagueId em falta na rota' },
      { status: 400 },
    );
  }

  try {
    const base = apiBase();
    if (!base) {
      return NextResponse.json(
        { error: 'API_BASE não configurada' },
        { status: 500 },
      );
    }

    // Proxy para o teu Worker / API que calcula o ranking da liga
    const upstream = await fetch(
      `${base}/api/leagues/${encodeURIComponent(leagueId)}/ranking`,
      { cache: 'no-store' },
    );

    const data = await upstream
      .json()
      .catch(() => ({ error: 'Resposta inválida da API de ranking' }));

    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    console.error('Erro a obter ranking da liga', err);
    return NextResponse.json(
      { error: 'Erro interno ao obter ranking da liga' },
      { status: 500 },
    );
  }
}
