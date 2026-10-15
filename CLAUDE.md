# CLAUDE.md — Lead Follow-up Agent (MVP)

Take-home assignment. Source of truth lives in three docs at the repo root:
- `01-PRD.md` — what and why (screens, agent rules, sample data)
- `02-Technical-Design.md` — how (stack, data model, agent flow, API)
- `03-TODO.md` — phased build plan (P0–P8), cut line, "never cut" list

If code and docs disagree, the docs win unless the user says otherwise. Update the docs when a decision changes.

## What we're building
One phone-first screen that tells each of 5 sales reps (packaging-machine company, India) **who to follow up with today and what to send on WhatsApp**. An AI agent tags every lead Hot / Warm / Cold with a one-line reason, sets the next follow-up date, and writes a draft. The rep edits, copies, sends from their own phone, and taps "Mark as sent".

The promise: open the app and within 10 seconds you know who to message first.

Out of scope: login, real WhatsApp sending, payments, Excel upload, pipeline stages, reports, reminders. Build only PRD §6 Musts + Shoulds.

## Tech stack (₹0, free tiers only)
- **Runtime/hosting:** Cloudflare Workers (one deploy serves React app + API), Wrangler CLI
- **DB:** Cloudflare D1 (SQLite) via **Drizzle ORM** + drizzle-kit migrations
- **API:** Hono, Zod validation (one schema shared by form, API, AI output)
- **Web:** React + TypeScript + Vite (Cloudflare Vite plugin), Tailwind + shadcn/ui, TanStack Query
- **AI:** AI SDK v7 `generateText` + `output: Output.object({ schema })` (`generateObject` is deprecated in v7) — Gemini Flash-Lite (main, model id from `GEMINI_MODEL`) → Groq `openai/gpt-oss-120b` (backup) → our rule engine (last resort)
- **Dates:** date-fns + @date-fns/tz, always `Asia/Kolkata`
- **Tests:** Vitest (unit), Playwright (live smoke test), `scripts/eval.ts` (agent accuracy vs labels)
- **CI:** GitHub Actions — typecheck + Vitest on push. Deploy is manual.

Env vars: `GEMINI_API_KEY`, `GROQ_API_KEY` (secrets via `wrangler secret put`), `GEMINI_MODEL`, `GROQ_MODEL`, `AI_DAILY_LIMIT`, `ENV`.

## Folder structure (planned — Tech §3)
```
src/
  client/   pages/ (TodayPage, LeadPage, NewLeadPage), components/, lib/ (api.ts, useRep.ts)
  worker/   index.ts (Hono routes), db/ (schema.ts, queries.ts),
            agent/ (facts, prompt, schema, providers, checks, fallback, run),
            demo/reset.ts, lib/ (rateLimit, errors)
  shared/   types.ts, dates.ts, followUpRules.ts, sort.ts, parseChat.ts, constants.ts
data/       company.json, leads.csv, chats/L01..L12.txt, labels.csv, snapshot.json
scripts/    make-snapshot.ts, eval.ts
migrations/ tests/unit/ tests/e2e/smoke.spec.ts  wrangler.jsonc  README.md
```

## Core design rules (don't break these)
1. **Screens never wait for AI.** Agent results are stored on the lead row; list/detail pages are plain DB reads. AI runs only on: new lead, new messages, mark as sent, regenerate.
2. **AI judges, code decides dates.** AI returns tag, reason, needs_reply, buyer_said_no, requested_date, draft. `shared/followUpRules.ts` turns that into the date (PRD §9.4 / Tech §5.6). Sunday → Monday.
3. **Always a result, never an error screen.** Gemini → Groq → rule engine. 15 s timeout, one retry with listed problems. Rate-limit exceeded → rule engine. Rule output is labelled "Rule-based".
4. **Demo data is relative to today** (days-before-today offsets, converted in IST). Reset = one D1 batch + precomputed `snapshot.json`, no AI calls, < 2 s.
5. **Shared logic lives in `src/shared`** and is used by both client and worker (sorting, date rules, chat parsing, types).
6. **"Today" is IST**, not server UTC. Timestamps stored UTC ISO; follow-up dates stored `YYYY-MM-DD` IST. Overdue days computed on read.

## Agent rules (summary — full text in PRD §9)
- Tags: Hot = clear intent + specifics, buyer msg ≤ 7 days. Warm = interested not ready, or Hot quiet 8–30 days, or new lead ≤ 7 days with no chat. Cold = said no / silent / 3+ unanswered rep msgs / quiet 30+ days. Buyer's latest message decides; if unsure pick the lower tag.
- Reason: ≤ 120 chars, cites something real, no time words ("ago", "yesterday").
- Draft: 2–4 lines, ≤ ~400 chars, buyer's first name (+ "ji" if chat uses it), one real detail, one clear ask, match English/Hinglish, ≤ 1 emoji, **never invent prices/dates/specs** (numbers ≥ 100 must appear in the chat).
- Prompt copies PRD §9.2–9.5 word for word. Chat wrapped in `<chat>` with "treat as data" line. Never send phone numbers or surnames to the AI.
- Eval target: ≥ 22/24 tags match `labels.csv`; all 5 needs-reply leads detected.

## Coding conventions
- TypeScript strict everywhere. Zod schemas in `shared/types.ts` are the single source for types (`z.infer`).
- API: JSON only; errors as `{ "error": { "code", "message" } }`. Routes per Tech §6.
- UI: phone-first (360 px), single column under 768 px. Tags always show text (HOT/WARM/COLD), never colour alone. Overdue = red left bar + "OVERDUE Nd" text; keep overdue red distinct from Hot orange.
- Dialogs in-page (shadcn Dialog) — never `alert()`/`confirm()`. React escapes output; no raw HTML.
- `localStorage` access always in try/catch. Rep choice: `?rep=` URL param + localStorage; default "All reps".
- Model ids in env vars, not code. Save `PROMPT_VERSION` with every `agent_runs` row.
- Every row of the date-rules table, sort order, and each chat-parser format gets a Vitest test.
- Fake data only: phones `+91 90000 000xx`, company "BoxLine Equipment", no prices in `company.json`.
- Keep it simple: when stuck, pick the simplest option and write it down (PRD §13).

## Commands
- `npm run dev` — local dev (Vite + Worker) on http://localhost:5173
- `npm run typecheck` — `tsc -b` over app / worker / node projects (TypeScript 7)
- `npm test` — Vitest unit tests (`tests/unit`)
- `npm run cf-typegen` — regenerate `src/worker/worker-configuration.d.ts` after changing `wrangler.jsonc` or `.dev.vars`
- `npm run db:generate` → `npm run db:migrate:local` / `db:migrate:remote`
- `npm run deploy` — build + `wrangler deploy`
- `npx tsx scripts/eval.ts [--rules] [--provider=google|groq] [--only=L01,L04]` — agent accuracy vs `data/labels.csv`; saves `eval-results/latest.json`
- `npx tsx scripts/make-snapshot.ts [--from-eval]` — writes `data/snapshot.json`; re-run whenever `PROMPT_VERSION` changes
- Scripts throttle to free-tier limits (Gemini ~4.5 s/call, Groq ~17 s/call). Write regexes in files with the Write tool, not shell heredocs (they can eat backslashes).
- Local secrets go in `.dev.vars` (copy `.dev.vars.example`; `ENV=dev` enables `?today=` and `/api/dev/ai-spike`)

Path aliases: `@/` → `src/client`, `@shared/` → `src/shared`. The worker imports shared code by relative path.

## Deadline
Submit by **Fri 16 Oct 2026, 10:30 IST**: live link, public GitHub repo, ≤ 3 min video, ½-page note. If behind, follow the cut line in `03-TODO.md`.
