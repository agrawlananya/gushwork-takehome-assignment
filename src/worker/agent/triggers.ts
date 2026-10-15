import type { AGENT_TRIGGERS } from "../../shared/constants";

/** What made the agent run (PRD §9.1), saved on each agent_runs row. */
export type AgentTrigger = (typeof AGENT_TRIGGERS)[number];
