# Lead Follow-up Agent — Product Requirements (MVP)

| | |
|---|---|
| **Product** | Lead Follow-up Agent (working name) |
| **Version** | 1.0 — MVP |

---

## 1. Summary

A small company that sells packaging machines has 5 sales reps. Leads sit in one Excel sheet and in WhatsApp chats. Reps forget to follow up, so good leads go cold, and the owner can't see who is hot or who needs a reply today.

We are building **one simple screen** that tells each rep **who to follow up with today** and **what to say**. An AI agent reads every lead and chat, tags it Hot / Warm / Cold with a one-line reason, sets the next follow-up date, and writes the next WhatsApp message. The rep checks it, edits if needed, sends it from their own phone, and marks it as sent.

**The one promise:** open the app, and within 10 seconds you know who to message first and what to send.

---

## 2. Problem

| What happens today | Why it hurts |
|---|---|
| Leads are spread across an Excel sheet and 5 reps' WhatsApp chats | Nobody has the full picture |
| Reps rely on memory to follow up | Buyers who asked for a quote wait days; they buy elsewhere |
| No shared idea of "hot" | Reps spend time on the wrong leads |
| Owner has no daily view | Can't step in before a good lead is lost |
| Writing each follow-up takes effort | Reps skip it, or send generic "any update?" messages |

---

## 3. Users

### 3.1 Sales rep (primary) — 5 people
- Works mostly from a phone, lives in WhatsApp.
- Handles 5–50 open leads.
- Wants: a short list for today, the right words to send, no extra typing.
- Will not use anything that takes more than a minute to learn.

### 3.2 Owner (secondary) — 1 person
- Wants to see, in one place, which leads are hot and who is late on a reply.
- Uses the same screen with "All reps" selected.

### 3.3 First real audience
The first people to open the live app will be reviewers acting like the owner and a rep. They will judge it in minutes. So the default view must work with zero setup, zero login, and fresh-looking data on any day they open it.

---

## 4. Goals and non-goals

### 4.1 Goals (MVP)
1. Every lead has a tag (Hot / Warm / Cold), a one-line reason, a next follow-up date and a ready-to-send draft.
2. The home screen shows today's follow-ups first, most urgent at the top, with overdue ones clearly marked.
3. A rep can open a lead, read the chat, edit the draft and mark it as sent.
4. A rep can add a new lead or new chat messages, and the agent updates that lead within seconds.
5. The app works every time it is opened, even if the AI service is down.

### 4.2 Non-goals (do not build)
Given in the brief as out of scope: **login, real WhatsApp sending, payments.**
Also not in this MVP (see §15 "Later"): Excel upload, WhatsApp API sync, lead stages / pipeline, reports, reminders by email or push, multi-company setup, roles and permissions.

### 4.3 Success measures

**For the MVP review (pass / fail):**

| Review check | What "pass" means for us | How we prove it |
|---|---|---|
| It works | Live link opens, main flow runs with no errors | Smoke test on the live URL before submitting; no console errors |
| Agent is useful | Tags and reasons match the chats | Agent agrees with our hand labels on ≥ 22 of 24 sample leads |
| Drafts are usable | A rep could send with small or no edits | Each draft names the buyer, refers to a real detail from the chat, has one clear ask, ≤ 4 short lines |
| Screen is clear | Rep knows who to call within 10 s | Top 5 follow-ups visible on first load without scrolling (laptop and phone) |
| Scope is right | Only what was asked, done well | Every feature maps to a line in the brief (§6) |
| You can explain it | Note and video explain how and why | Tag rules are written as a simple table (§9.2) |

**After launch (real customers):**

| Metric | Target |
|---|---|
| Follow-ups due today that are marked sent the same day | ≥ 80% |
| Drafts sent with no or small edits | ≥ 60% |
| Leads overdue by more than 2 days | Falling week on week |
| Reps who open the app on a working day | 5 of 5 |

---

## 5. Key terms

| Term | Meaning |
|---|---|
| **Lead** | A buyer (person + company) a rep is trying to sell to |
| **Chat** | The WhatsApp messages between the rep and that buyer |
| **Tag** | Hot, Warm or Cold — how likely the buyer is to buy soon |
| **Reason** | One line saying why the lead got that tag, based on the chat |
| **Next follow-up date** | The day the rep should next message this buyer |
| **Needs reply** | The buyer's last message asks something, or the rep promised to get back. The ball is in our court |
| **Due today** | Next follow-up date is today |
| **Overdue** | Next follow-up date has passed and nothing was sent |
| **Draft** | The follow-up message the agent wrote for the rep to send |
| **Mark as sent** | The rep confirms they sent the message on WhatsApp themselves |

---

## 6. Scope

Every "Must" maps to a line in the brief. Anything else is a "Should" (small, makes the Musts work well) or "Won't".

| # | Feature | Priority | Brief line |
|---|---|---|---|
| 1 | Sample data: 24 leads, 12 chats | Must | Step 1 |
| 2 | Agent reads leads and chats | Must | Step 2.1 |
| 3 | Tag + one-line reason per lead | Must | Step 2.2 |
| 4 | Next follow-up date per lead | Must | Step 2.3 |
| 5 | Draft next message per lead | Must | Step 2.4 |
| 6 | Today list, most urgent first | Must | Step 3 |
| 7 | Overdue clearly marked | Must | Step 3 |
| 8 | Lead detail: chat, tag, reason, draft | Must | Step 3 |
| 9 | Edit draft, mark as sent | Must | Step 3 |
| 10 | Add new lead / new chat → agent updates the lead | Must | Step 3 |
| 11 | Rep switcher ("Viewing: Priya / All reps") | Must | "tells each rep…" — no login, so this replaces it |
| 12 | Works when AI is down (rule-based backup) | Should | "It works" check |
| 13 | Demo data always looks fresh; "Reset demo data" button | Should | "It works" on any day reviewers open it |
| 14 | Copy draft button | Should | Rep needs to paste into WhatsApp |
| 15 | Upcoming (next 7 days) and All leads with search | Should | Needed to find a lead to add a chat to |
| 16 | Per-rep counts for owner (overdue / today / hot) | Should | Owner problem in brief |
| 17 | Login, WhatsApp sending, payments | Won't | Out of scope in brief |
| 18 | Excel upload, analytics, reminders, pipeline stages | Won't (Later) | Not asked |

---

## 7. User journeys

Simple, step-by-step. Each one is a real moment in a rep's or owner's day.

### J1 — Rep's morning follow-ups (the main flow)
1. Priya opens the link on her phone. It remembers her name from last time (first visit shows "All reps").
2. She sees **"Today — 2 follow-ups"**. The top card is red: **Overdue 1 day · Hot · Ramesh Gupta, Gupta Namkeen — "Wants final price for 2 shrink wrappers; waiting on our reply."**
3. She taps it. She sees the tag and reason at the top, then the draft, then the chat.
4. She reads the draft, changes one word, taps **Copy**.
5. She opens WhatsApp, pastes and sends it to Neha.
6. Back in the app she taps **Mark as sent**.
7. The lead drops off today's list. The agent sets the next follow-up date (e.g. in 2 days) and prepares the next draft.
8. She goes back and opens the next card.

**Done when:** today's list is empty or every item is marked sent.

### J2 — Buyer replied on WhatsApp
1. Rahul gets a reply from a buyer on WhatsApp.
2. In the app he opens that lead (from Today, Upcoming, or search in All leads).
3. He taps **Add messages**, pastes the new WhatsApp lines (or types "Buyer: …"), and taps **Add & update**.
4. The app shows "Agent is updating this lead…" for a few seconds.
5. Tag, reason, follow-up date and draft refresh. A small note says what changed, e.g. "Warm → Hot".

### J3 — New lead comes in
1. Sneha gets a call from a new buyer.
2. She taps **+ New lead**, fills name, company, phone, source, and picks herself as the rep. Last contact date defaults to today.
3. Optional: she pastes the first few WhatsApp messages.
4. She taps **Save**. The agent tags the lead and writes a first message.
5. If it's due today, it shows up in her Today list right away.

### J4 — Owner's daily check
1. The owner opens the app and picks **All reps**.
2. A strip at the top shows: **5 need reply · 8 overdue · 5 hot**, and a count per rep.
3. The Today list shows every rep's follow-ups, each with the rep's name.
4. He sees Sneha has 2 overdue, one of them a Hot lead with budget approved, and calls her.

### J5 — Reviewer opens the link a few days later
1. The data still looks current: dates are set relative to today, not fixed.
2. If someone has messed up the data, a **Reset demo data** link at the bottom restores the sample set in under 2 seconds (no AI calls needed).

---

## 8. Screens and requirements

### 8.1 Screen map

```
Today (home) ──tap a lead──▶ Lead detail ──▶ Add messages
   │                            │
   ├── + New lead ──────────────┘ (after save, opens the new lead)
   ├── Upcoming (next 7 days)
   └── All leads (search)
```

### 8.2 Today (home)

```
┌───────────────────────────────────────────────┐
│ Follow-ups · Wed 14 Oct  Viewing: [All reps ▼]│
│ 5 need reply · 8 overdue · 5 hot  [+ New lead]│
├───────────────────────────────────────────────┤
│ NEEDS YOUR REPLY                              │
│ ▌OVERDUE 4d  HOT   Farah Shaikh · Shaikh Pharma│
│ ▌ Asked us to confirm a demo slot; no reply   │
│ ▌ from us yet.                 Rahul     ›    │
│ ▌OVERDUE 2d  HOT   Neha Jain · Jain Textiles  │
│ ▌ Wants a lower price on 2 strapping          │
│ ▌ machines; waiting on us.     Arjun     ›    │
│  ...                                          │
│  DUE TODAY   WARM  Mohammed Ali · Ali Bakers  │
│   Asked band sealer price; no reply yet.  ›   │
│ HOT                                           │
│ ...                                           │
│ WARM / COLD ...                               │
├───────────────────────────────────────────────┤
│ Upcoming (7) ▸        All leads (24) ▸        │
│                         Reset demo data       │
└───────────────────────────────────────────────┘
```

| ID | Requirement | Acceptance check |
|---|---|---|
| T-1 | Show all leads due today or overdue under **Today**, in the order set in §10 | With sample data, the first card is the oldest "needs reply" Hot lead |
| T-2 | Overdue cards have a red left bar and a red label "Overdue N days" | Visible at a glance; label is text, not only colour |
| T-3 | Each card shows: due label, tag, name, company, one-line reason, rep name (in All reps view) | All fields present on 360 px wide phone |
| T-4 | Header shows today's date (India time) and counts: needs reply, overdue, hot | Counts match the list |
| T-5 | Rep switcher with 5 reps + "All reps". Choice is remembered on this device | Reload keeps the choice |
| T-6 | Upcoming section (next 7 days), collapsed by default | Shows date per lead |
| T-7 | All leads with search by name, company or phone | Typing "jain" finds Neha Jain |
| T-8 | Empty state: "No follow-ups today 🎉" with link to Upcoming | Shown when list is empty |
| T-9 | No AI call happens when this screen loads | Loads from saved results; < 2 s on 4G |

### 8.3 Lead detail

```
┌───────────────────────────────────────────────┐
│ ‹ Back   Neha Jain · Jain Textiles            │
│ +91 90000 00004 · Referral · Rep: Arjun       │
├───────────────────────────────────────────────┤
│ HOT  "Wants a lower price on 2 strapping      │
│       machines; waiting on us."               │
│ Next follow-up: Mon 12 Oct (overdue 2 days)   │
│ Why this date: buyer is waiting for a reply   │
├───────────────────────────────────────────────┤
│ Draft message                                 │
│ ┌───────────────────────────────────────────┐ │
│ │ Hi Neha ji, I've asked my manager for the  │ │
│ │ best price on 2 units. Can you share the   │ │
│ │ other quote so I can try to match it?      │ │
│ └───────────────────────────────────────────┘ │
│ [Copy]  [Mark as sent]   Regenerate           │
├───────────────────────────────────────────────┤
│ Chat                                          │
│   Buyer  Bhaiya strapping machine ka rate...  │
│              Rep  Sir, ₹1,45,000 per unit...  │
│ [+ Add messages]                              │
└───────────────────────────────────────────────┘
```

| ID | Requirement | Acceptance check |
|---|---|---|
| D-1 | Show lead info: name, company, phone, source, rep, last contact date | All shown |
| D-2 | Show tag, reason, next follow-up date and "why this date" | Matches the list card |
| D-3 | Draft is an editable text box. Edits save automatically (or on blur) | Reload keeps the edit; label shows "Edited" |
| D-4 | **Copy** puts the draft on the clipboard and shows "Copied" | Paste works in WhatsApp |
| D-5 | **Mark as sent**: saves the final text as a rep message in the chat, sets last contact = now, then re-runs the agent for this lead | Lead leaves Today; new date and new draft appear |
| D-6 | **Regenerate** re-runs the agent for this lead. If the rep edited the draft, ask first ("Replace your edited draft?") using an in-page dialog | Edit is not lost without asking |
| D-7 | Chat shown as bubbles: buyer left, rep right, with date and time | Easy to read on phone |
| D-8 | If the agent's result came from the backup rules (AI down), show a small label "Rule-based" | Rep knows the draft may be more generic |
| D-9 | On phone, order is: tag + reason → draft → chat | Rep acts without scrolling |

### 8.4 Add messages (inside lead detail)

| ID | Requirement | Acceptance check |
|---|---|---|
| C-1 | A text box where the rep pastes WhatsApp lines or types simple lines like `Buyer: price?` / `Rep: sent` | Both formats accepted |
| C-2 | Understands WhatsApp "Export chat" lines (Android `12/10/26, 4:15 pm - Name: text` and iPhone `[12/10/26, 4:15:02 PM] Name: text`) | Sample export parses correctly |
| C-3 | Before saving, show a preview: "3 messages found (2 from buyer, 1 from rep)" | Rep can fix wrong sides |
| C-4 | Lines with no time get "now"; names that match the rep's name count as rep, everything else as buyer | Predictable result |
| C-5 | On save: messages added, last contact updated, agent re-runs, results refresh, "what changed" note shown | Shown within ~10 s |
| C-6 | Limits: max 10,000 characters per paste | Friendly error if too long |

### 8.5 New lead

| ID | Requirement | Acceptance check |
|---|---|---|
| N-1 | Fields: name*, company*, phone*, source* (IndiaMART, Website, Trade show, Referral, Cold call, WhatsApp inbound), rep* (defaults to current rep), last contact date (default today), optional chat paste | Required fields checked |
| N-2 | Phone check: 10-digit Indian mobile, with or without +91 | Clear error message |
| N-3 | If the phone already exists, warn: "This number belongs to <lead>. Open it instead?" | No silent duplicates |
| N-4 | On save: agent runs, then the new lead opens | Tag, reason, date, draft visible |

---

## 9. How the agent decides

The agent works the same way for every lead, every time it runs. It has three steps so that its choices are easy to explain and test.

### 9.1 The three steps

```
Lead + chat
   │
   ▼
1. FACTS (plain code)       days since last contact, who sent the last
                            message, how many rep messages in a row got
                            no reply, does the lead have a chat at all
   │
   ▼
2. JUDGEMENT (AI)           reads the chat with the facts and the rules
                            below → tag, reason, "needs reply?",
                            date the buyer asked for (if any), draft
   │
   ▼
3. CHECKS + DATE (code)     checks the AI answer is valid, sets the next
                            follow-up date using the date rules, saves
                            If the AI fails → backup rules do steps 2–3
```

**When does the agent run?**

| Trigger | Runs for |
|---|---|
| First load of sample data (done once, results saved) | All leads |
| New lead saved | That lead |
| New messages added | That lead |
| Mark as sent | That lead |
| Regenerate tapped | That lead |

### 9.2 Tag rules (Hot / Warm / Cold)

If a lead fits more than one row, the **buyer's latest message decides**. If still unsure, the agent picks the lower tag.

| Tag | When | Examples from chats |
|---|---|---|
| **Hot** | Buyer shows clear intent **and** something specific (quantity, timeline, budget, decision), and the buyer's last message is ≤ 7 days old | Asked for final quote for 2 units; asked for a demo or site visit; negotiating price; "budget approved"; asked payment terms or delivery date |
| **Warm** | Buyer is interested but not ready, or a Hot lead went quiet | Asked for catalogue or video; comparing options; "will discuss with partner"; price asked with no quantity or timeline; Hot signals but the buyer has been quiet for 8–30 days; new lead (≤ 7 days) with no chat yet |
| **Cold** | Buyer said no or not now, or has gone silent | "Not needed now"; "bought from another supplier"; no reply to our last 3+ messages in a row; buyer quiet for 30+ days; no chat and last contact > 7 days ago |

### 9.3 Reason rules
- One line, max 120 characters.
- Must point to something real in the chat or lead (what the buyer asked or said, and the state).
- No time words like "2 days ago" — the screen shows dates separately (keeps the reason true as days pass).
- Good: "Asked for final price on 2 shrink wrappers; waiting on our reply."
- Bad: "Lead seems interested."

### 9.4 Next follow-up date rules

Applied by code, in this order. Sundays move to Monday.

| # | Situation | Next follow-up date |
|---|---|---|
| 1 | **Needs reply** (buyer asked something, or rep promised to get back) | The day the buyer asked (or the rep promised) — we should reply same day. If that day has passed, it shows as overdue |
| 2 | Buyer named a day ("call me next Monday", "after the 20th") | That day |
| 3 | Buyer said no / bought elsewhere | Last contact + 60 days (light check-in later) |
| 4 | **Hot** | Last contact + 2 days |
| 5 | **Warm** | Last contact + 5 days |
| 6 | **Cold** | Last contact + 14 days, but never before today (cold leads are not shown as overdue on first scoring, to keep the list clean) |

The detail screen shows "Why this date" using the rule's plain-language name, e.g. "Hot lead — 2 days after last contact".

### 9.5 Draft rules
- WhatsApp style: 2–4 short lines, max ~400 characters.
- Starts with the buyer's first name (add "ji" if the chat uses it).
- Mentions one real detail from the chat (machine, quantity, last question).
- Ends with one clear, easy next step (a question, a time for a call, confirm a visit).
- Matches the buyer's language and tone (English or Hinglish).
- Never makes up prices, discounts, delivery dates or specs. Only uses numbers already in the chat. If a number is needed but missing, it asks a question instead.
- Never promises a better price, a discount, a "special offer" or a slot the rep has not confirmed. If the buyer is waiting on something the rep must decide, the draft says the rep is checking and asks one useful question. *(Added after the P1 AI test, where a draft offered an unapproved "special bundle discount".)*
- Written as the rep, in first person.
- Cold leads: a soft check-in with an easy way out. No guilt ("I've messaged you 3 times…").
- Leads with no chat: a short first message introducing the rep and the company, tied to the lead's source.
- At most one emoji. No sign-off block.

### 9.6 When the AI fails
If the AI service is down, slow (> 15 s) or returns something invalid twice, the **backup rules** run instead:
- Tag from keywords and facts (e.g. "quote", "price", "demo", "budget" → Warm or Hot; "not interested", "another supplier" → Cold; 3+ unanswered rep messages in a row → Cold).
- Reason from a template ("Buyer asked about price; no reply from us yet").
- Draft from a template per tag, filled with name, company and machine.
- The lead shows the label **Rule-based**, and the next run (e.g. Regenerate) tries the AI again.

The app must never show an error instead of a result.

### 9.7 Example decisions (from the sample data)

| Lead | What the chat shows | Tag | Next date | Draft (short) |
|---|---|---|---|---|
| Farah Shaikh, Shaikh Pharma | Asked to confirm a demo slot 4 days ago; no reply from us | Hot | 4 days ago → **overdue 4d** | "Hi Farah, sorry for the delay on this. Does Thursday or Friday work for the demo? Share a time and I'll block it." |
| Mohammed Ali, Ali Bakers | Asked band sealer price for 500 g pouches this morning; no quantity | Warm | Today | "Hi Mohammed, yes we have band sealers for 500 g pouches. How many pouches a day do you pack? I'll share the right model and price." |
| Vikram Rao, Rao Agro | Asked for a quote 12 days ago; we sent it and followed up once; no reply since | Warm | Overdue | "Hi Vikram, just checking if you had a chance to look at the stretch wrapper quote. Happy to jump on a 5-min call if anything is unclear." |
| Deepak Singh, Singh Logistics | "We went with another supplier, thanks" | Cold | +60 days | "Thanks for letting me know, Deepak. If you need spares or a second machine later, I'm a message away." |

---

## 10. Sorting the Today list

Groups, top to bottom:
1. **Needs your reply** (the buyer is waiting)
2. **Hot**
3. **Warm**
4. **Cold**

Inside each group: most days overdue first, then the most recent buyer message first.
Overdue cards are red in every group. Group headings are shown so a rep can see at a glance where the important ones stop.

Why groups instead of a pure "overdue first" list: an overdue cold lead should not push a buyer who is waiting for a price today down the list.

---

## 11. Sample data

Built by us, saved in the code repo, loaded on first run and on "Reset demo data".

### 11.1 Shape
- **Leads file** (`leads.csv`, same columns as the owner's Excel): id, name, company, phone, source, rep, last contact (as "days before today").
- **Chats folder**: one `.txt` per chat in WhatsApp "Export chat" format, times written as "days before today" and converted on load.
- **Company profile** (one small file): company name (fictional: "BoxLine Equipment"), city, product list with one-line uses. No prices — so drafts can't quote made-up numbers.
- **Expected labels**: our own Hot / Warm / Cold label for each lead, used to test the agent.

All names, companies and numbers are fake. Phones use `+91 90000 000xx`.

### 11.2 Lead set (24 leads, 12 with chats)

Reps: Priya, Rahul, Sneha, Arjun, Imran. Products: carton sealer, shrink wrapper, strapping machine, stretch wrapper, band sealer, labelling machine.

| ID | Lead · Company | Source | Rep | Last contact | Chat? | Story | Expected |
|---|---|---|---|---|---|---|---|
| L01 | Ramesh Gupta · Gupta Namkeen | IndiaMART | Priya | 1 day ago | Yes | Wants final price for 2 shrink wrappers, will confirm tomorrow; waiting on us | Hot · needs reply |
| L02 | Farah Shaikh · Shaikh Pharma Packaging | Trade show | Rahul | 4 days ago | Yes | Asked us to confirm a demo slot; we never replied | Hot · needs reply |
| L03 | Vikram Rao · Rao Agro Exports | Website | Sneha | 9 days ago | Yes | Got stretch wrapper quote, 1 follow-up unanswered; buyer quiet 12 days | Warm |
| L04 | Neha Jain · Jain Textiles | Referral | Arjun | 2 days ago | Yes (Hinglish) | Needs 2 strapping machines next week, asking for a lower price | Hot · needs reply |
| L05 | Sanjay Patel · Patel Dairy | IndiaMART | Imran | 20 days ago | Yes | Took catalogue, "call me next week, partner travelling" | Warm |
| L06 | Anita Desai · Desai Spices | Cold call | Priya | 35 days ago | Yes | "Not needed now, bought one last year" | Cold |
| L07 | Mohammed Ali · Ali Bakers | WhatsApp inbound | Rahul | Today | Yes | First message: band sealer price, no quantity | Warm · needs reply |
| L08 | Kiran Reddy · Reddy Beverages | Trade show | Sneha | 6 days ago | Yes | Buyer (7 days ago): budget approved, needs install in 3 weeks; we sent proforma next day, no reply yet | Hot |
| L09 | Pooja Mehta · Mehta Cosmetics | Website | Arjun | 12 days ago | Yes | Comparing labelling machines, "will check with production head" | Warm |
| L10 | Harish Kumar · Kumar Hardware | Referral | Imran | 45 days ago | Yes | Showed early interest; 3 follow-ups since, no reply | Cold |
| L11 | Deepak Singh · Singh Logistics | IndiaMART | Priya | 3 days ago | Yes | "We went with another supplier" | Cold |
| L12 | Sunita Iyer · Iyer Foods | Trade show | Rahul | 1 day ago | Yes | Wants engineer visit Friday for 3 lines; rep said "will confirm by evening" and didn't | Hot · needs reply |
| L13 | Rajesh Verma · Verma Plastics | IndiaMART | Sneha | 1 day ago | No | New inquiry | Warm |
| L14 | Meera Nair · Nair Exports | Website | Arjun | 2 days ago | No | New inquiry | Warm |
| L15 | Ajay Thakur · Thakur Snacks | Cold call | Imran | 18 days ago | No | Old cold call | Cold |
| L16 | Lakshmi Krishnan · LK Garments | Trade show | Priya | 5 days ago | No | Met at stall | Warm |
| L17 | Rohit Agarwal · Agarwal Paper | Referral | Rahul | 25 days ago | No | Old referral | Cold |
| L18 | Nikhil Joshi · Joshi Chemicals | IndiaMART | Sneha | 60 days ago | No | Very old inquiry | Cold |
| L19 | Swati Kulkarni · Kulkarni Foods | Website | Arjun | Today | No | Form filled today | Warm |
| L20 | Manoj Tiwari · Tiwari Distributors | Cold call | Imran | 10 days ago | No | Cold call | Cold |
| L21 | Ritu Bansal · Bansal Ceramics | Trade show | Priya | 8 days ago | No | Met at stall, no contact since | Cold |
| L22 | Gaurav Malhotra · Malhotra Auto Parts | Referral | Rahul | 3 days ago | No | Fresh referral | Warm |
| L23 | Divya Pillai · Pillai Organics | IndiaMART | Sneha | 1 day ago | No | New inquiry | Warm |
| L24 | Arvind Chauhan · Chauhan Steel | Website | Imran | 30 days ago | No | Old web inquiry | Cold |

Mix: 5 Hot, 10 Warm, 9 Cold. Five "needs reply" cases (four of them overdue) so the overdue styling is visible on day one.

---

## 12. Non-functional requirements

| Area | Requirement |
|---|---|
| Speed | Today screen usable in < 2 s on 4G. Agent update for one lead usually < 10 s, with a clear "updating" state |
| Reliability | Main flow works even if every AI service fails (backup rules). No errors in the browser console on the main flow |
| Phone first | Works from 360 px wide; buttons easy to tap |
| Clarity | Tags always show text (HOT / WARM / COLD), not just colour; good contrast |
| Time zone | "Today" and all dates use India time (IST), not server time |
| Fresh demo | Sample dates are relative to today; reset in < 2 s with no AI calls |
| Privacy | Fake data only. Phone numbers are never sent to the AI. A small banner: "Demo — please don't enter real customer data" |
| Abuse | No login, so AI runs are rate-limited (per visitor and per day) and inputs have size limits |
| Cost | ₹0 to run: free tiers only |

---

## 13. Assumptions and decisions

The brief says: "Stuck? Pick the simplest option, write it down." These are those choices.

| # | Assumption / decision | Why |
|---|---|---|
| A1 | No login → a rep switcher, remembered on the device | Login is out of scope, but "each rep" still needs their own list |
| A2 | Default view on first visit is "All reps" | Reviewers and the owner see everything in one look |
| A3 | Each lead has exactly one rep | Matches "5 reps" setup; simplest |
| A4 | "Mark as sent" means the rep sent it on WhatsApp by hand | Real sending is out of scope |
| A5 | Chats are added by pasting text | No WhatsApp API in scope |
| A6 | Business is in India; time zone IST; Mon–Sat working days | WhatsApp-first B2B selling, Hinglish chats |
| A7 | The agent sets the date with fixed rules, the AI only reads the chat | Dates are easy to explain and test; AI does what it's good at |
| A8 | Leads can't be deleted or closed in the MVP | Not asked; "said no" leads just get a far-off date |
| A9 | A new paste of messages replaces an unsent draft (rep is told) | New messages make the old draft wrong |

---

## 14. Risks

| Risk | Impact | Plan |
|---|---|---|
| Free AI limits run out or the service is slow during review | "It works" fails | Results saved, not generated on page load; backup rules; a second AI provider |
| Sample dates go stale if reviewers open days later | Nothing is "today" | Dates stored relative to today; reset button |
| AI writes a made-up price or promise | Rep sends something wrong | Draft rules + no prices in company profile + rep always reviews |
| Tags feel random | "Agent is useful" fails | Written rules (§9.2), tested against our 24 labels |
| Public link, no login, people edit or spam it | Messy demo, AI limits used up | Rate limits, size limits, reset button |
| Scope creep (building "real product" features) | "Scope is right" fails, deadline missed | Build only §6 Musts + Shoulds; everything else goes in the note as "next" |

---

## 15. Later (what we'd build next)

In rough order of value for a real launch:
1. **WhatsApp Business API** — read chats and send drafts from the app (removes copy-paste).
2. **Excel / Google Sheet import** and sync for leads.
3. **Login and roles** (rep sees own leads, owner sees all).
4. **Reminders** — a morning WhatsApp or email to each rep with their list.
5. **Learning from edits** — use how reps change drafts to improve tone and tags.
6. **Lead stages** (new → quoted → negotiating → won/lost) and simple owner reports.
7. **Manual tag override** with a reason, to correct the agent and measure accuracy.

---

## 16. Open questions (answer before or during build)

1. Should the rep be able to change the follow-up date by hand (snooze)? *MVP: no — not asked.*
2. Should the owner get a separate view, or is "All reps" enough? *MVP: All reps + counts.*
3. Should "Reset demo data" also run automatically every night? *MVP: no; manual button. Revisit if reviewers report stale data.*

---

## 17. Submission checklist

| # | Deliverable | Ready when |
|---|---|---|
| 1 | Live link | Opens with no setup, sample data loaded, smoke test passed |
| 2 | Code on GitHub | Public repo, README with how it works and how to run |
| 3 | Video (≤ 3 min) | Shows J1, J2, J3 as a rep would use it |
| 4 | Short note (½ page) | What we built, how tags are decided (§9.2), AI tools used, what's next (§15) |
