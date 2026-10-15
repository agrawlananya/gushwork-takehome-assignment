import { Hono } from "hono";
import { isIsoDate, todayIST } from "../shared/dates";
import { apiError } from "./lib/errors";
import { runSpike } from "./spike";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

/** Today in IST. In dev only, `?today=YYYY-MM-DD` overrides it (Tech §7). */
function resolveToday(env: Env, override: string | undefined): string {
  if (env.ENV === "dev" && override && isIsoDate(override)) return override;
  return todayIST();
}

app.get("/health", (c) => c.json({ ok: true, todayIST: resolveToday(c.env, c.req.query("today")) }));

// P1 spike. Open in dev; on the live Worker it needs the SPIKE_TOKEN secret in an `x-spike-token` header.
app.get("/dev/ai-spike", async (c) => {
  const token = c.env.SPIKE_TOKEN;
  const allowed = c.env.ENV === "dev" || (Boolean(token) && c.req.header("x-spike-token") === token);
  if (!allowed) return apiError(c, 404, "NOT_FOUND", "Not found");
  const results = await runSpike(c.env);
  if (results.length === 0) return apiError(c, 400, "VALIDATION", "Set GEMINI_API_KEY and/or GROQ_API_KEY first");
  return c.json({ results });
});

app.notFound((c) => apiError(c, 404, "NOT_FOUND", "Not found"));
app.onError((err, c) => {
  console.error(err);
  return apiError(c, 500, "INTERNAL", "Something went wrong");
});

export default app;
