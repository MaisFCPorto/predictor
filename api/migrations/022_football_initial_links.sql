-- Explicit associations for existing backoffice names that differ from Google.
-- Reuse the original IDs and preserve any association already chosen by an admin.

-- Académico de Viseu F.C. -> Ac. Viseu FC
INSERT OR IGNORE INTO football_team_links (kgmid, team_id)
SELECT '/m/01xn49s', id FROM teams WHERE id = 'AVFC';

-- G.D. Estoril Praia -> Estoril Praia
INSERT OR IGNORE INTO football_team_links (kgmid, team_id)
SELECT '/m/05hywl', id FROM teams WHERE id = 'est';

-- UEFA Champions League -> Liga dos Campeões
INSERT OR IGNORE INTO football_competition_links (kgmid, competition_id)
SELECT '/m/0c1q0', id FROM competitions WHERE code = 'LC';

-- Supertaça Cândido de Oliveira -> Supertaça
INSERT OR IGNORE INTO football_competition_links (kgmid, competition_id)
SELECT '/m/05j8n2', id FROM competitions WHERE code = 'ST';
