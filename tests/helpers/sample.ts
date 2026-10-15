import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSampleLeads, parseCsv } from "../../src/shared/sampleData";

const dataDir = fileURLToPath(new URL("../../data/", import.meta.url));

export function readData(file: string): string {
  return readFileSync(`${dataDir}${file}`, "utf8");
}

export function loadSampleLeads(now: Date) {
  const chats = Object.fromEntries(
    readdirSync(`${dataDir}chats`).map((f) => [f.replace(".txt", ""), readData(`chats/${f}`)]),
  );
  return buildSampleLeads(readData("leads.csv"), chats, now);
}

export function loadLabels() {
  return Object.fromEntries(parseCsv(readData("labels.csv")).map((r) => [r.id!, r]));
}
