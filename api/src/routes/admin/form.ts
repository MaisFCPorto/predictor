import { Hono } from "hono";

type Env = {
  DB: D1Database;
  ADMIN_KEY: string;
};

const adminForm = new Hono<{ Bindings: Env }>();

adminForm.post("/", async (c) => {
  // usa o mesmo header que já usas no projeto
  const need = c.env.ADMIN_KEY;
  if (need) {
    const got = c.req.header("x-admin-key");
    if (!got || got !== need) return c.json({ error: "forbidden" }, 403);
  }

  const body = await c.req.json();
  const teamId = String(body.teamId || "").trim();
  const last5 = String(body.last5 || "").trim();
  const last5Matches = body.last5Matches || [];

  if (!teamId) return c.text("Invalid teamId", 400);
  if (!/^[WDL]{5}$/.test(last5)) return c.text("Invalid last5", 400);

  const updatedAt = new Date().toISOString();

  await c.env.DB.prepare(`
    INSERT INTO team_form (team_id, updated_at, last5, last5_json)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(team_id) DO UPDATE SET
      updated_at=excluded.updated_at,
      last5=excluded.last5,
      last5_json=excluded.last5_json
  `).bind(teamId, updatedAt, last5, JSON.stringify(last5Matches)).run();

  return c.json({ ok: true, teamId, last5, updatedAt });
});

export default adminForm;
