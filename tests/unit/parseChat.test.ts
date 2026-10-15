import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addDays, istDateOf } from "@shared/dates";
import { applySenders } from "@shared/api";
import { guessSender, parseChat, senderOf } from "@shared/parseChat";

// Thursday 15 Oct 2026, 12:00 IST.
const NOW = new Date("2026-10-15T06:30:00Z");
const TODAY = "2026-10-15";
const opts = { repName: "Arjun", buyerName: "Neha Jain", now: NOW };

describe("parseChat — sample file format (D-n)", () => {
  it("reads D-n dates relative to today in IST", () => {
    const { messages } = parseChat("D-3, 14:05 - Neha Jain: Rate bhejo", opts);
    expect(messages).toEqual([
      { sender: "buyer", text: "Rate bhejo", sentAt: "2026-10-12T08:35:00.000Z", timeKnown: true, senderKnown: true },
    ]);
  });

  it("clamps a D-0 time later than now to now", () => {
    const { messages } = parseChat("D-0, 18:00 - Neha Jain: Evening msg", opts);
    expect(messages[0]!.sentAt).toBe(NOW.toISOString());
  });

  it("skips the encryption notice", () => {
    const text = [
      "D-4, 13:10 - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.",
      "D-4, 13:10 - Neha Jain: Namaste",
    ].join("\n");
    expect(parseChat(text, opts).messages.map((m) => m.text)).toEqual(["Namaste"]);
  });
});

describe("parseChat — WhatsApp exports (PRD C-2)", () => {
  it("reads Android 12-hour lines, including the narrow space before pm", () => {
    const { messages } = parseChat("12/10/26, 4:15 pm - Neha Jain: price?", opts);
    expect(messages[0]).toMatchObject({ sender: "buyer", text: "price?", sentAt: "2026-10-12T10:45:00.000Z" });
  });

  it("reads Android 24-hour lines and 12 am as midnight", () => {
    const { messages } = parseChat(
      ["12/10/26, 16:15 - Arjun: sent", "13/10/2026, 12:05 am - Neha Jain: ok"].join("\n"),
      opts,
    );
    expect(messages.map((m) => [m.sender, m.sentAt])).toEqual([
      ["rep", "2026-10-12T10:45:00.000Z"],
      ["buyer", "2026-10-12T18:35:00.000Z"],
    ]);
  });

  it("reads iPhone lines with seconds and invisible direction marks", () => {
    const { messages } = parseChat("‎[12/10/26, 4:15:02 PM] Neha Jain: ‎image omitted", opts);
    expect(messages[0]).toMatchObject({ sender: "buyer", text: "image omitted", sentAt: "2026-10-12T10:45:00.000Z" });
  });

  it("swaps US-style month/day when the day can't be a month", () => {
    const { messages } = parseChat("10/13/26, 9:00 am - Neha Jain: hi", opts);
    expect(istDateOf(messages[0]!.sentAt)).toBe("2026-10-13");
  });

  it("skips system lines with no sender", () => {
    const text = ["12/10/26, 4:15 pm - Neha Jain joined using this group's invite link", "12/10/26, 4:16 pm - Neha Jain: hi"];
    expect(parseChat(text.join("\n"), opts).messages).toHaveLength(1);
  });

  it("joins multi-line messages", () => {
    const text = ["12/10/26, 4:15 pm - Neha Jain: Need 2 units", "Delivery by next week", "", "Note: bales are 40 kg"];
    const { messages } = parseChat(text.join("\n"), opts);
    expect(messages).toHaveLength(1);
    expect(messages[0]!.text).toBe("Need 2 units\nDelivery by next week\nNote: bales are 40 kg");
  });

  it("handles Windows line endings", () => {
    const { messages } = parseChat("12/10/26, 4:15 pm - Neha Jain: a\r\n12/10/26, 4:16 pm - Arjun: b\r\n", opts);
    expect(messages.map((m) => m.text)).toEqual(["a", "b"]);
  });
});

describe("parseChat — simple typed lines (PRD C-1, C-4)", () => {
  it("reads Buyer: / Rep: lines and gives them 'now', in order", () => {
    const { messages, counts } = parseChat("Buyer: price?\nRep: sent\nbuyer: thanks", opts);
    expect(messages.map((m) => [m.sender, m.text, m.timeKnown])).toEqual([
      ["buyer", "price?", false],
      ["rep", "sent", false],
      ["buyer", "thanks", false],
    ]);
    expect(messages.map((m) => m.sentAt)).toEqual([
      "2026-10-15T06:29:58.000Z",
      "2026-10-15T06:29:59.000Z",
      NOW.toISOString(),
    ]);
    expect(counts).toEqual({ buyer: 2, rep: 1 });
  });

  it("recognises the rep's and buyer's names without a time", () => {
    const { messages } = parseChat("Neha Jain: ok\nArjun: will call", opts);
    expect(messages.map((m) => m.sender)).toEqual(["buyer", "rep"]);
  });

  it("treats a first line with no sender as the buyer, flagged as a guess", () => {
    const { messages } = parseChat("Bhaiya rate kam karo", opts);
    expect(messages).toMatchObject([{ sender: "buyer", text: "Bhaiya rate kam karo", timeKnown: false, senderKnown: false }]);
  });

  it("guesses the rep when an unlabelled message addresses the buyer (the rep pasting their own sent text)", () => {
    const pasted = "Neha ji, sorry for the wait on the rate for 2 units.\nI am checking with my manager now. Can I call you at 4?";
    const { messages } = parseChat(pasted, opts);
    expect(messages).toMatchObject([{ sender: "rep", senderKnown: false }]);
    expect(messages[0]!.text).toContain("checking with my manager");
  });

  it("names on a line always win over the guess", () => {
    expect(parseChat("Neha Jain: Neha here, any update?", opts).messages[0]).toMatchObject({ sender: "buyer", senderKnown: true });
  });
});

describe("guessSender", () => {
  it("rep when the text opens by addressing the buyer or as sir/ma'am", () => {
    expect(guessSender("Farah, sorry for the wait on the demo slot", "Farah Shaikh")).toBe("rep");
    expect(guessSender("Hi Farah, sharing the brochure", "Farah Shaikh")).toBe("rep");
    expect(guessSender("Namaste Neha ji! Kitne units chahiye?", "Neha Jain")).toBe("rep");
    expect(guessSender("Ma'am ₹1,45,000 per unit", "Neha Jain")).toBe("rep");
    expect(guessSender("Sir, the quote is attached", "Ramesh Gupta")).toBe("rep");
  });

  it("buyer otherwise, including a buyer greeting the rep", () => {
    expect(guessSender("Hi Rahul, please confirm the slot", "Farah Shaikh")).toBe("buyer");
    expect(guessSender("Thoda kam karo bhaiya", "Neha Jain")).toBe("buyer");
    expect(guessSender("Farahbad unit needs 2 machines", "Farah Shaikh")).toBe("buyer"); // whole word only
    expect(guessSender("price?")).toBe("buyer");
  });
});

describe("applySenders", () => {
  const msgs = [
    { sender: "buyer" as const, text: "a" },
    { sender: "buyer" as const, text: "b" },
  ];

  it("applies the rep's switches by position", () => {
    expect(applySenders(msgs, ["rep", "buyer"]).map((m) => m.sender)).toEqual(["rep", "buyer"]);
  });

  it("ignores a list that doesn't match the parsed messages", () => {
    expect(applySenders(msgs, ["rep"])).toBe(msgs);
    expect(applySenders(msgs, undefined)).toBe(msgs);
  });

  it("returns nothing for empty input", () => {
    expect(parseChat("  \n\n", opts)).toEqual({ messages: [], counts: { buyer: 0, rep: 0 } });
  });
});

describe("senderOf", () => {
  it("matches the rep by first name, case-insensitive", () => {
    expect(senderOf("Priya", "Priya")).toBe("rep");
    expect(senderOf("priya sharma", "Priya")).toBe("rep");
    expect(senderOf("Priya (BoxLine)", "Priya")).toBe("rep");
    expect(senderOf("Me", "Priya")).toBe("rep");
  });

  it("treats everyone else as the buyer", () => {
    expect(senderOf("Ramesh Gupta", "Priya")).toBe("buyer");
    expect(senderOf("Priyanka", "Priya")).toBe("buyer");
  });
});

describe("parseChat — all 12 sample chats", () => {
  const dataDir = fileURLToPath(new URL("../../data/", import.meta.url));
  const leads = readFileSync(`${dataDir}leads.csv`, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((row) => {
      const [id, name, , , , rep, daysAgo] = row.split(",");
      return { id: id!, name: name!, rep: rep!, daysAgo: Number(daysAgo) };
    });
  const chatIds = readdirSync(`${dataDir}chats`).map((f) => f.replace(".txt", ""));

  it("has 12 chat files", () => expect(chatIds).toHaveLength(12));

  for (const id of chatIds) {
    it(`${id} parses with the right senders and last-contact date`, () => {
      const lead = leads.find((l) => l.id === id)!;
      const text = readFileSync(`${dataDir}chats/${id}.txt`, "utf8");
      const { messages } = parseChat(text, { repName: lead.rep, buyerName: lead.name, now: NOW });

      // Expected senders read straight from the file: every line after the notice is "D-n, HH:MM - Name: text".
      const expected = text
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((line) => (line.split(" - ")[1]!.split(":")[0] === lead.rep ? "rep" : "buyer"));

      expect(messages.map((m) => m.sender)).toEqual(expected);
      expect(messages.every((m) => m.timeKnown && m.text.length > 0)).toBe(true);
      expect(istDateOf(messages.at(-1)!.sentAt)).toBe(addDays(TODAY, -lead.daysAgo));
    });
  }
});
