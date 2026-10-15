import { z } from "zod";

// Tech §5.4. The AI's answer must pass this before we use it.
export const AgentOutput = z.object({
  tag: z.enum(["hot", "warm", "cold"]),
  reason: z.string().min(10).max(120),
  evidence: z.string().max(200),
  needs_reply: z.boolean(),
  buyer_said_no: z.boolean(),
  requested_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  draft: z.string().min(20).max(500),
});

export type AgentOutput = z.infer<typeof AgentOutput>;
