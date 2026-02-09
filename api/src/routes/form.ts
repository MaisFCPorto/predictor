import { Hono } from "hono";

type Env = {
    DB: D1Database;
  };
  

const form = new Hono<{ Bindings: Env }>();

form.get("/:teamId", async (c) => {
  const teamId = c.req.param("teamId");

  const row = await c.env.DB.prepare(`
    SELECT team_id, updated_at, last5
    FROM team_form
    WHERE team_id = ?
  `).bind(teamId).first();

  if (!row) {
    return c.json({ teamId, last5_pt: null }, 404);
  }

  const mapPT: Record<string, string> = { W: "V", D: "E", L: "D" };
  const last5_pt = String(row.last5)
    .split("")
    .map(c => mapPT[c] || c)
    .join("");

  return c.json({
    teamId,
    last5: row.last5,
    last5_pt,
    updatedAt: row.updated_at
  }, 200, {
    "Cache-Control": "public, max-age=300"
  });
});

export default form;
