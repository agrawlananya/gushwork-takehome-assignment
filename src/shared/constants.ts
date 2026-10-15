export const TAGS = ["hot", "warm", "cold"] as const;
export const SENDERS = ["rep", "buyer"] as const;
export const SOURCES = ["IndiaMART", "Website", "Trade show", "Referral", "Cold call", "WhatsApp inbound"] as const;
export const DATE_RULES = ["needs_reply", "buyer_asked", "said_no", "hot_plus_2", "warm_plus_5", "cold_plus_14"] as const;
export const DRAFT_STATUSES = ["ai", "edited"] as const;
export const AGENT_SOURCES = ["ai", "rules"] as const;
export const MESSAGE_ORIGINS = ["seed", "paste", "mark_sent"] as const;
export const AGENT_TRIGGERS = ["seed", "new_lead", "new_messages", "sent", "regenerate", "deleted"] as const;

export const REPS = [
  { id: "priya", name: "Priya" },
  { id: "rahul", name: "Rahul" },
  { id: "sneha", name: "Sneha" },
  { id: "arjun", name: "Arjun" },
  { id: "imran", name: "Imran" },
] as const;

/** Plain-language "Why this date" text for the lead detail screen (PRD §9.4). */
export const DATE_RULE_LABELS: Record<(typeof DATE_RULES)[number], string> = {
  needs_reply: "Buyer is waiting for our reply",
  buyer_asked: "Buyer asked us to follow up on this day",
  said_no: "Buyer said no — light check-in 60 days after last contact",
  hot_plus_2: "Hot lead — 2 days after last contact",
  warm_plus_5: "Warm lead — 5 days after last contact",
  cold_plus_14: "Cold lead — 14 days after last contact",
};

// Input limits (PRD C-6, Tech §10).
export const MAX_PASTE_CHARS = 10_000;
export const MAX_PASTE_MESSAGES = 200;
