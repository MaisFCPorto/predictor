import { Hono } from "hono";

type Env = {
  DB: D1Database;
};

export const form = new Hono<{ Bindings: Env }>();

form.get("/:teamId", async (c) => {
  const teamId = c.req.param("teamId")?.trim();
  if (!teamId) return c.json({ error: "missing_teamId" }, 400);

  const row = await c.env.DB.prepare(
    "SELECT team_id, last5, last5_json, updated_at FROM team_form WHERE team_id = ?"
  )
    .bind(teamId)
    .first<{
      team_id: string;
      last5: string | null;
      last5_json: string | null;
      updated_at: string | null;
    }>();

  if (!row) return c.json(null, 404);

  // devolver last5_json como array (se estiver guardado como JSON string)
  let last5_json: any[] = [];
  try {
    last5_json = row.last5_json ? JSON.parse(row.last5_json) : [];
  } catch {
    last5_json = [];
  }

  return c.json({
    teamId: row.team_id,
    last5: row.last5 ?? "",
    last5Matches: last5_json,
    updatedAt: row.updated_at,
  });
});
