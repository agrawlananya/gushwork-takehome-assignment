import { defineConfig } from "drizzle-kit";

// Schema arrives in P3 (src/worker/db/schema.ts). Migrations are applied with wrangler.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/worker/db/schema.ts",
  out: "./migrations",
});
