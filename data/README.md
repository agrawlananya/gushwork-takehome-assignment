# Sample data

Fake demo data for BoxLine Equipment (a made-up company). All names, companies and phone numbers are invented; phones use `+91 90000 000xx`.

| File | What it is |
|---|---|
| `company.json` | Company name, city and the 6 products with one-line uses. **No prices**, so the agent cannot quote made-up numbers. |
| `leads.csv` | 24 leads, same columns as the owner's Excel. `last_contact_days_ago` is days before today (IST), so the demo always looks current. `rep` is the rep's first name. |
| `chats/Lxx.txt` | 12 chats in WhatsApp Android "Export chat" format, except the date is written as `D-n` (n days before today) instead of a real date. Times are 24-hour IST. |
| `labels.csv` | Our own expected tag and needs-reply flag per lead, with a one-line reason. Used by `scripts/eval.ts` to score the agent. |
| `snapshot.json` | (Generated in P4) agent output for these leads, so a demo reset needs no AI calls. |

## Chat line format

```
D-3, 14:05 - Neha Jain: Bhaiya 2 units chahiye
D-3, 15:20 - Arjun: Ma'am ₹1,45,000 per unit
```

- The first line of each file is WhatsApp's encryption notice (as in a real export); the parser skips it.
- A sender whose name matches the lead's rep is the rep; anyone else is the buyer.
- `<Media omitted>` is kept, as in a real export (the buyer or rep sent a photo or PDF).
- A chat's last message date always equals the lead's `last_contact_days_ago`.

## Loading rules (for `demo/reset.ts`)

- `D-n, HH:MM` → that IST date and time, converted to UTC for storage.
- If a `D-0` time is later than the current time (someone opens the demo early in the morning), clamp it to now, so no message is in the future.
- Leads with no chat: `created_at` = last contact.
