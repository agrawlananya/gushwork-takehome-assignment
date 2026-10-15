# Lead Follow-up Agent

**One phone-first screen that tells each sales rep who to follow up with today — and what to send on WhatsApp.**

A packaging-machine company has 5 sales reps. Leads sit in an Excel sheet and in WhatsApp chats, so follow-ups slip and good buyers go cold. An AI agent reads every lead and chat, tags it **Hot / Warm / Cold** with a one-line reason, sets the next follow-up date, and drafts the next WhatsApp message. The rep reviews it, sends it from their own phone, and taps **Mark as sent**.

> Open the app, and within 10 seconds you know who to message first and what to send.

**Live app:** https://lead-followup-agent.22051664.workers.dev — no login, sample data loaded, works on a phone.

---

## What it does

- **Today list, ranked** — buyers waiting on our reply first, then Hot, Warm, Cold; inside each group, most overdue first. Overdue cards get a red bar and an "Overdue Nd" label.
- **Counts at a glance** — need reply · overdue · hot, for everyone or per rep (rep switcher, remembered on the device).
- **Upcoming** (next 7 days) and **All leads** with search by name, company or phone.
- **Lead detail** — tag, reason, next follow-up date and *why that date*, the draft, and the WhatsApp chat.
- **Draft tools** — edit (autosaved), Copy, **Mark as sent** (with Undo), **Regenerate**, and **Rewrite with instructions** ("Make it shorter", "More formal", "Push for a quick call", "Write it in Hinglish", or your own words).
- **Add messages** — paste WhatsApp export lines (Android or iPhone) or simple `Buyer:` / `Rep:` lines; a preview shows who sent each message (tap to switch); the agent re-scores the lead and shows what changed (e.g. "Warm → Hot").
- **New lead** — validated form (Indian mobile check, duplicate-number warning), optional first messages; the lead is scored before it's saved.
- **Always a result** — if the AI is slow or down, backup rules still tag and draft (labelled "Rule-based").
- **Reset demo data** — restores the 24 sample leads with dates relative to today, so the demo never goes stale.

## How the agent decides

Three steps for every lead, every time:

```
Lead + chat
  1. FACTS (code)        days since contact, who spoke last, unanswered rep messages, has chat?
  2. JUDGEMENT (AI)      tag, one-line reason, needs reply?, date the buyer asked for, draft
  3. CHECKS + DATE (code) validate the AI answer, then set the follow-up date by fixed rules
                          AI fails or answers badly → Gemini → Groq → backup rules
```

**AI judges, code decides dates** — dates stay predictable and testable.

### Tags

| Tag | When |
|---|---|
| **Hot** | Clear intent **and** something specific (quantity, timeline, budget, decision), and the buyer wrote in the last **7 days** |
| **Warm** | Interested but not ready; or Hot signals but quiet for **8–30 days**; or a new lead (≤ 7 days) with no chat yet |
| **Cold** | Said no / bought elsewhere; **3+** of our messages in a row unanswered; quiet **30+ days**; or no chat and last contact > 7 days |

The buyer's latest message decides; if still unsure, the lower tag. Leads with no chat are tagged by code (nothing for the AI to judge).

### Next follow-up date (code, in this order; Sunday moves to Monday)

| Situation | Date |
|---|---|
| Buyer is waiting on us (asked something, or we promised to get back) | The day they asked — shows as overdue if past |
| Buyer named a day ("call me next week") | That day |
| Buyer said no | Last contact + 60 days |
| Hot / Warm / Cold | Last contact + 2 / 5 / 14 days (Cold never before today) |

### Guardrails on every AI answer

Checked in code before saving; one retry with the problems listed, then the next provider:

- No numbers ≥ 100 (prices, quantities) that aren't in the chat; no weekdays the buyer never mentioned.
- No "confirmed / booked / approved / dispatched" claims the chat doesn't support.
- Draft starts with the buyer's name, ≤ ~400 characters, no filler openers ("hope you are doing well", "just checking in").
- Reasons contain no time words ("2 days ago"), so they stay true as days pass.
- The chat is passed as data inside `<chat>` tags; phone numbers and surnames are never sent to the AI.
- "Rewrite" instructions shape the wording only — all rules still apply (e.g. "offer a 20% discount" is declined).

## Results

Evaluated with `scripts/eval.ts` on the 24 sample leads against hand-written labels (`data/labels.csv`):

| | Tags correct | "Needs reply" caught | False alarms |
|---|---|---|---|
| Gemini Flash-Lite (main) | **24 / 24** | **5 / 5** | 0 |
| Groq gpt-oss-120b (backup, earlier prompt version) | 23 / 24 | 5 / 5 | 2 |
| Backup rules only | 24 / 24* | 5 / 5 | 0 |

\* The rule keywords were written against these same chats — expect lower on real data.

Also: **112** unit tests, **27** API smoke checks passing against the live app, and failover tested live (bad Gemini key → Groq; both bad → rules). Sample data in the live app was produced by the real agent ahead of time (`data/snapshot.json`), so a reset needs no AI calls; anything you add runs the agent live.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Hosting + API | **Cloudflare Workers** (free) | One deploy serves the app and API; never sleeps, so the first click is fast |
| Database | **Cloudflare D1** (SQLite) + **Drizzle ORM** | Built into Workers, doesn't pause when idle, typed queries and SQL migrations |
| API | **Hono** + **Zod** | Small, typed routes; one schema shared by the form, the API and the AI output |
| Web app | **React + TypeScript + Vite**, **Tailwind CSS**, **TanStack Query** | Fast to build, phone-first, simple caching and loading states |
| AI | **AI SDK** → **Gemini Flash-Lite** (main), **Groq gpt-oss-120b** (backup), own **rule engine** (last resort) | Highest free daily limit, structured JSON output, two independent providers |
| Dates | **date-fns** + **@date-fns/tz** | "Today" is India time (IST), not server UTC |
| Tests | **Vitest**, API smoke script, agent eval script | Rules, sorting, parsing and agent accuracy are all measured |

Running cost: **₹0** (free tiers only).

## Run it locally

Requires Node 22+.

```bash
npm install
cp .dev.vars.example .dev.vars        # add GEMINI_API_KEY and GROQ_API_KEY (optional — without keys the backup rules answer)
npm run db:migrate:local
npm run dev                            # http://localhost:5173 → scroll down → "Reset demo data" to load the sample leads
```

Other commands:

```bash
npm test                               # unit tests
npm run typecheck
npx tsx scripts/eval.ts                # agent accuracy vs data/labels.csv (needs AI keys)
npx tsx scripts/smoke-api.ts           # hits every API route (resets demo data before and after)
npm run deploy                         # build + deploy to Cloudflare (needs `wrangler login`, D1 and secrets)
```

## Project structure

```
src/
  client/    React app — pages (Today, Lead, New lead), components, API client
  worker/    Hono API — routes, D1 schema + queries, demo reset, rate limits
    agent/   the agent: facts, prompt, checks, providers, backup rules, run (no DB, so scripts can run it)
  shared/    used by both sides — types, dates (IST), follow-up rules, sorting, chat parser
data/        sample company, 24 leads, 12 chats, labels, precomputed snapshot
scripts/     eval, snapshot, API smoke test
migrations/  SQL migrations
tests/unit/  Vitest tests
```

Full details: [Product requirements](01-PRD.md) · [Technical design](02-Technical-Design.md) · [Build plan](03-TODO.md)

## Decisions and known limits

- **No login** (out of scope) — a rep switcher stands in, remembered on the device. Default view is "All reps".
- **Chats are pasted**, not synced — no WhatsApp API in scope. "Mark as sent" means the rep sent it themselves.
- **Public link, no login** — AI runs are capped at **30 per hour per visitor** and **400 per day**; over the cap, backup rules answer instead of failing.
- **Free-tier limits** — agent requests use ~11–19 ms of CPU against Cloudflare's 10 ms free-plan guideline (all succeeded in testing); free AI tiers can be slower at peak times (2–10 s per agent run, capped at 20 s).
- **AI drafts vary a little run to run** — guardrails catch invented numbers, days and "confirmed" claims, but the rep always reviews before sending.
- **Data privacy** — demo data is fake. Google's free Gemini terms allow prompts to be used to improve their products, so a real launch would move to a paid, no-training tier.
- Leads can't be deleted or closed in the MVP; buyers who said no simply get a far-off check-in date.

## future add ons

1. **WhatsApp Business API** — read chats and send drafts from the app (no copy-paste).
2. **Excel / Google Sheet import** and sync for leads.
3. **Login and roles** — each rep sees their own leads; the owner sees all.
4. **Morning reminder** to each rep with their list.
5. **Learn from edits** — use how reps change drafts to improve tone and tags.
