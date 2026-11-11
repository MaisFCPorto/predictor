import { isSportsKgmid, type PortoCalendarGame } from './serpapi-sports';

type Team = PortoCalendarGame['teams'][number];
type StoredTeam = { id: string; name: string; short_name: string | null; crest_url: string | null };
type PlannedTeam = Team & { id: string; newTeam: boolean };
const portoKgmid = '/m/0177gl';

function normalized(name: string) {
  return name.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

// These statements join the calendar transaction, so a failed calendar import
// cannot leave new clubs or partially updated crests behind.
export async function prepareCalendarTeams(
  db: D1Database,
  games: readonly PortoCalendarGame[],
  season: string,
  lease: string,
): Promise<D1PreparedStatement[]> {
  const [stored, linked] = await Promise.all([
    db.prepare('SELECT id, name, short_name, crest_url FROM teams').all<StoredTeam>(),
    db.prepare('SELECT kgmid, team_id FROM football_team_links').all<{ kgmid: string; team_id: string }>(),
  ]);
  const teams = [...stored.results];
  const byId = new Map(teams.map((team) => [team.id, team]));
  const links = new Map(linked.results.map((link) => [link.kgmid, link.team_id]));
  const assigned = new Set(links.values());
  const incoming = new Map<string, Team>();
  for (const team of games.flatMap((game) => game.teams)) {
    if (!isSportsKgmid(team.kgmid)) continue;
    const previous = incoming.get(team.kgmid);
    incoming.set(team.kgmid, previous ? {
      ...previous,
      name: previous.name || team.name,
      shortName: previous.shortName || team.shortName,
      shortCode: previous.shortCode || team.shortCode,
      crestUrl: previous.crestUrl || team.crestUrl,
    } : team);
  }

  const planned: PlannedTeam[] = [];
  for (const [kgmid, team] of incoming) {
    let id = links.get(kgmid);
    let newTeam = false;
    if (!id) {
      if (!team.name) continue;
      if (kgmid === portoKgmid && byId.has('fcp')) id = 'fcp';
      else {
        const names = new Set([team.name, team.shortName].filter((name): name is string => Boolean(name)).map(normalized));
        const matches = teams.filter((candidate) => names.has(normalized(candidate.name)) ||
          (candidate.short_name && names.has(normalized(candidate.short_name))));
        // Existing aliases need an explicit association when names or identities conflict.
        if (matches.length > 1 || (matches.length === 1 && (assigned.has(matches[0].id) || matches[0].id === 'fcp'))) continue;
        id = matches[0]?.id;
        if (!id) {
          id = kgmid === portoKgmid ? 'fcp' : 'serp-team-' + kgmid.slice(1).replace('/', '-');
          if (byId.has(id)) continue;
          newTeam = true;
          const created = { id, name: team.name, short_name: team.shortName ?? team.shortCode ?? null, crest_url: team.crestUrl ?? null };
          teams.push(created);
          byId.set(id, created);
        }
      }
      links.set(kgmid, id);
      assigned.add(id);
    }
    planned.push({ ...team, shortName: team.shortName ?? team.shortCode ?? null, id, newTeam });
  }
  if (!planned.length) return [];
  const json = JSON.stringify(planned);
  const gate = 'EXISTS (SELECT 1 FROM football_sync_state WHERE season_id = ? AND lease_token = ?)';
  return [
    db.prepare(`WITH incoming AS (SELECT value AS team FROM json_each(?))
      INSERT OR IGNORE INTO teams (id, name, short_name, crest_url)
      SELECT json_extract(team, '$.id'), json_extract(team, '$.name'),
        json_extract(team, '$.shortName'), json_extract(team, '$.crestUrl') FROM incoming
      WHERE json_extract(team, '$.newTeam') = 1 AND ${gate}
        AND NOT EXISTS (SELECT 1 FROM football_team_links WHERE kgmid = json_extract(team, '$.kgmid'))`)
      .bind(json, season, lease),
    db.prepare(`WITH incoming AS (SELECT value AS team FROM json_each(?))
      INSERT OR IGNORE INTO football_team_links (kgmid, team_id)
      SELECT json_extract(team, '$.kgmid'), json_extract(team, '$.id') FROM incoming
      WHERE ${gate} AND EXISTS (SELECT 1 FROM teams
        WHERE id = json_extract(team, '$.id') AND (json_extract(team, '$.newTeam') = 0 OR name = json_extract(team, '$.name')))`)
      .bind(json, season, lease),
    db.prepare(`WITH incoming AS (
        SELECT l.team_id, json_extract(value, '$.crestUrl') AS crest, json_extract(value, '$.shortName') AS short
        FROM json_each(?) JOIN football_team_links l ON l.kgmid = json_extract(value, '$.kgmid')
      ) UPDATE teams SET
        crest_url = CASE WHEN TRIM(COALESCE(crest_url, '')) = '' THEN
          COALESCE((SELECT crest FROM incoming WHERE team_id = teams.id AND crest IS NOT NULL LIMIT 1), crest_url) ELSE crest_url END,
        short_name = CASE WHEN TRIM(COALESCE(short_name, '')) = '' THEN
          COALESCE((SELECT short FROM incoming WHERE team_id = teams.id AND short IS NOT NULL LIMIT 1), short_name) ELSE short_name END
      WHERE id IN (SELECT team_id FROM incoming) AND ${gate}`)
      .bind(json, season, lease),
  ];
}
