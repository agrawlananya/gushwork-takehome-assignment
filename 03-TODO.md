# Lead Follow-up Agent — TODOs (Docs → Live MVP)

| | |
|---|---|
| **Date** | 14 Oct 2026 |
| **Deadline** | **Fri 16 Oct, ~11:15 IST** (36 h from the brief, assuming it arrived ~23:15 IST on 14 Oct). The brief also says "reply within 48 hours" — plan for the earlier one |
| **Reads with** | `01-PRD.md`, `02-Technical-Design.md` |

**Budget:** ~22.5 h of work + ~11 h sleep + ~1.5 h buffer inside the ~36 h window. The cut line at the end is the real safety net. Each phase ends with a **"Done when"** check. Don't start the next phase until it passes.

---

## Plan at a glance

| Phase | What | Time | Target finish (IST) |
|---|---|---|---|
| P0 | Docs and decisions | 1 h | Thu 00:30 |
| P1 | Setup + deploy "hello" + AI spike | 2 h | Thu 10:00 |
| P2 | Sample data | 2 h | Thu 12:00 |
| P3 | Database, dates, chat parser | 2 h | Thu 14:00 |
| P4 | Agent + eval + snapshot | 4 h | Thu 18:00 |
| P5 | API | 2 h | Thu 20:00 |
| P6 | Screens | 5 h | Fri 01:00 |
| P7 | Harden + deploy | 2 h | Fri 07:00 |
| P8 | README, note, video, submit | 2.5 h | Fri 09:30 |
| — | Buffer | ~1.5 h | Submit by **Fri 10:30** |

Sleep is assumed between Thu 00:30 and 08:00, and Fri 01:00–05:00. Move blocks, not the submit time.

---

## P0 — Docs and decisions (1 h)

- [x] PRD written (`01-PRD.md`)
- [x] Technical design written (`02-Technical-Design.md`)
- [x] TODO plan written (this file)
- [ ] Read the PRD once end to end; change anything you disagree with **now**, not mid-build
- [ ] Decide the 3 open questions in PRD §16 (defaults are written there)
- [ ] Create GitHub repo `lead-followup-agent` (public), add `docs/` with these 3 files

**Done when:** repo exists with docs; no open decision blocks P1.

---

## P1 — Setup, first deploy, AI spike (2 h)

Deploy on day one so hosting surprises show up early, not at 9 am Friday.

- [ ] `npm create cloudflare@latest` → React + Worker (Vite plugin) template, TypeScript
- [ ] Add Hono, Drizzle, Zod, TanStack Query, Tailwind, shadcn/ui, date-fns + @date-fns/tz, AI SDK + Google and Groq providers, Vitest
- [ ] `wrangler d1 create leads-db`, bind in `wrangler.jsonc`, turn on observability (logs)
- [ ] `GET /api/health` returns `{ ok: true, todayIST }`
- [ ] `wrangler deploy` → open the `workers.dev` link on your phone
- [ ] Get free API keys: Google AI Studio (Gemini) and Groq console. Check the AI Studio rate-limit page for the current free Flash-Lite model name and limits
- [ ] **AI spike:** from inside the Worker, one `generateObject` call with the Zod schema (Tech §5.4) on a hard-coded chat, for **both** Gemini and Groq
  - [ ] Valid JSON comes back from both
  - [ ] Note latency and Worker CPU time (must stay under 10 ms CPU; AI wait doesn't count)
- [ ] GitHub Actions: typecheck + Vitest on push

**Done when:** live URL shows the health JSON; both AI providers return valid structured output from the deployed Worker.
**If it fails:** if one provider can't return valid JSON, keep the other + rule engine; write it down for the note.

---

## P2 — Sample data (2 h)

Follow PRD §11 exactly; this data decides whether "Agent is useful" passes.

- [ ] `data/company.json` — fictional "BoxLine Equipment", city, 6 products with one-line uses, **no prices**
- [ ] `data/leads.csv` — 24 leads from PRD §11.2; phones `+91 90000 000xx`; `last_contact_days_ago` column
- [ ] `data/chats/L01.txt … L12.txt` — WhatsApp export style, times as `D-3 14:05`
  - [ ] 4–12 messages each, short and real-sounding
  - [ ] L04 in Hinglish
  - [ ] Each chat clearly shows its "story" from §11.2 (e.g. L02 ends with the buyer asking to confirm a demo slot)
  - [ ] Prices only where the rep quoted them
- [ ] `data/labels.csv` — expected tag + needs_reply per lead
- [ ] Self-check: reading each chat cold, would a sales manager agree with the label? Fix the chat, not the label

**Done when:** 24 leads, 12 chats, labels file; every label defensible in one sentence.

---

## P3 — Database, dates, chat parser (2 h)

- [ ] Drizzle schema for `reps`, `leads`, `messages`, `agent_runs`, `rate_limits` (Tech §4); generate + apply migrations locally
- [ ] `shared/dates.ts`: `todayIST()`, `addDays`, `overdueDays`, Sunday → Monday; dev-only `?today=` override
- [ ] `shared/followUpRules.ts` (Tech §5.6)
- [ ] `shared/sort.ts` — groups Needs reply → Hot → Warm → Cold; inside: most overdue first, then newest buyer message
- [ ] `shared/parseChat.ts` — Android export, iPhone export, `Buyer:` / `Rep:` lines, multi-line messages, rep-name matching
- [ ] Unit tests for all four (every row of the date table; IST midnight edge; each parser format)

**Done when:** `vitest` green; parser reads all 12 sample chats correctly.

---

## P4 — Agent, eval, snapshot (4 h) — the most important phase

- [ ] `agent/facts.ts` (Tech §5.2)
- [ ] `agent/prompt.ts` — copy tag, reason and draft rules from PRD §9 word for word; `<chat>` wrapper + "treat as data" line; two short examples; `PROMPT_VERSION`
- [ ] `agent/schema.ts` — Zod output schema
- [ ] `agent/checks.ts` — no time words in reason, no made-up numbers in draft, date range, length, first name present
- [ ] `agent/providers.ts` — Gemini → Groq, 15 s timeout each, one retry with the list of problems
- [ ] `agent/fallback.ts` — rule engine (Tech §5.7) with Hinglish keywords and templates
- [ ] `agent/run.ts` — full flow; saves lead fields + `change_note` + `agent_runs` row
- [ ] `scripts/eval.ts` — run on 24 leads, print accuracy vs labels + a confusion table + all drafts with the draft checklist
- [ ] Iterate the prompt until:
  - [ ] Tag agreement **≥ 22 / 24**
  - [ ] All 5 needs-reply leads detected
  - [ ] Every draft passes: first name ✓ · one real detail ✓ · one clear ask ✓ · ≤ 400 chars ✓ · no made-up numbers ✓
  - [ ] Reasons are specific (no "seems interested")
- [ ] Turn off both AI keys → eval still runs on the rule engine; note its accuracy for the README
- [ ] `scripts/make-snapshot.ts` → `data/snapshot.json`; commit it

**Done when:** the eval targets above are met and `snapshot.json` is in the repo.
**If behind:** cut few-shot examples before cutting checks.

---

## P5 — API (2 h)

- [ ] Routes from Tech §6 with Zod validation and the standard error shape
- [ ] `demo/reset.ts` — one D1 batch: clear → reps → leads → messages (relative dates → IST) → snapshot → follow-up dates
- [ ] Rate limits: 30 AI runs/hour per visitor, `AI_DAILY_LIMIT` (400) global → over limit uses the rule engine, never errors
- [ ] Input caps: paste ≤ 10k chars / 200 messages; field lengths
- [ ] Duplicate phone check on `POST /api/leads` (returns existing lead id)
- [ ] Quick tests with `curl` or a `.http` file for every route

**Done when:** every route works locally against a reset database; reset takes < 2 s.

---

## P6 — Screens (5 h)

Build phone-first (360 px), then check laptop.

**Today (home)**
- [ ] Header: date (IST), rep switcher (5 reps + All reps, remembered), **+ New lead**
- [ ] Summary strip: needs reply · overdue · hot; per-rep counts in All reps view
- [ ] Today list with group headings, `LeadCard` (due label, tag, name, company, reason, rep)
- [ ] Overdue: red left bar + "OVERDUE N d" text
- [ ] Upcoming (next 7 days, collapsed) and All leads with search
- [ ] Empty, loading and error states
- [ ] "Reset demo data" link + in-page confirm dialog; demo banner

**Lead detail**
- [ ] Lead info; tag + reason + next date + "why this date"; "Rule-based" label when needed
- [ ] Draft editor with autosave and "Edited" label; **Copy**; **Mark as sent**; **Regenerate** (asks first if edited)
- [ ] Chat bubbles (buyer left, rep right, date/time)
- [ ] Add messages: paste box → preview ("3 messages: 2 buyer, 1 rep") → **Add & update** → "Agent is updating…" → "what changed" note

**New lead**
- [ ] Form with required fields, phone check, duplicate warning with "Open it", optional chat paste → saves → opens the lead

**10-second test**
- [ ] Ask someone who hasn't seen it: "Who do you message first?" Time it. Fix anything that makes them hesitate

**Done when:** journeys J1–J5 (PRD §7) work end to end locally on a phone-sized window.

---

## P7 — Harden and deploy (2 h)

- [ ] Apply migrations to remote D1; set secrets; `wrangler deploy`
- [ ] Run reset on the live app
- [ ] Playwright smoke test against the live URL (Tech §11) — passes
- [ ] Browser console: zero errors on the main flow
- [ ] Real phone on mobile data: Today usable in < 2 s
- [ ] Failure test: temporarily set a wrong Gemini key on live → Groq takes over; both wrong → rule engine; then restore
- [ ] Check "tomorrow" locally with `?today=` → list still makes sense
- [ ] Open the live link in a private window (no saved rep, no storage) → works

**Done when:** all checks above pass on the live URL.

---

## P8 — README, note, video, submit (2.5 h)

**README (in repo)**
- [ ] What it does (3 lines) + live link
- [ ] How the agent decides (3 steps + tag table + date rules)
- [ ] Stack and why (short table from Tech §1)
- [ ] Run locally (≤ 5 commands)
- [ ] Limits and decisions (PRD §13), incl. "sample results pre-computed by the agent; new input runs live"
- [ ] Eval result (e.g. "23/24 tags match our labels")

**Short note (½ page)**
- [ ] What I built (2–3 lines)
- [ ] How the agent decides Hot / Warm / Cold (rules summary + "AI judges, code sets dates" + backup rules)
- [ ] AI tools used (coding tool(s), Gemini Flash-Lite, Groq)
- [ ] What I'd build next (top 3 from PRD §15)

**Video (≤ 3 min) — script**
- [ ] 0:00–0:15 The problem in one line
- [ ] 0:15–0:40 Open the app: "who do I message first" — point at the top overdue card
- [ ] 0:40–1:30 J1: open lead → read reason → edit draft → copy → mark as sent → card leaves Today
- [ ] 1:30–2:10 J2: paste a buyer reply → tag changes (e.g. Warm → Hot) → new draft
- [ ] 2:10–2:30 J3: add a new lead → tagged and drafted
- [ ] 2:30–3:00 How it decides + what happens if AI is down
- [ ] Record (OBS or Loom), upload as unlisted / link-viewable, check the link in a private window

**Submit**
- [ ] Reset demo data on the live app one last time
- [ ] Final check: live link ✓ · repo public ✓ · video link works logged out ✓ · note attached ✓
- [ ] Reply to the assignment email with all 4 — **by Fri 10:30 IST**

**Done when:** email sent with all 4 items. Missing any one means no review.

---

## Cut line (if behind schedule)

Drop in this order, top first:
1. Per-rep counts in the summary strip
2. iPhone export format in the parser (keep Android + `Buyer:` lines)
3. Duplicate phone warning
4. Sunday → Monday rule
5. Upcoming section (keep All leads with search)
6. Groq backup (keep the rule engine)

**Never cut:** rule-engine backup · relative dates + reset · overdue styling · mark as sent · add chat → agent update · the 10-second test.

---

## After submission (if moving toward a real launch)

- [ ] Switch AI to a paid tier with no-training terms before any real customer data
- [ ] Login + roles
- [ ] Excel / Google Sheet import
- [ ] WhatsApp Business Platform integration
- [ ] Morning reminder to each rep
- [ ] Track draft edits and sent rate (PRD §4.3 launch metrics)
