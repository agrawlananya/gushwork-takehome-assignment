import { Hono } from "hono";
import { isIsoDate, todayIST } from "../shared/dates";
import { apiError } from "./lib/errors";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

/** Today in IST. In dev only, `?today=YYYY-MM-DD` overrides it (Tech §7). */
function resolveToday(env: Env, override: string | undefined): string {
  if (env.ENV === "dev" && override && isIsoDate(override)) return override;
  return todayIST();
}

app.get("/health", (c) => c.json({ ok: true, todayIST: resolveToday(c.env, c.req.query("today")) }));

app.notFound((c) => apiError(c, 404, "NOT_FOUND", "Not found"));
app.onError((err, c) => {
  console.error(err);
  return apiError(c, 500, "INTERNAL", "Something went wrong");
});

export default app;
