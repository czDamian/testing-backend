import { z } from "zod";

export const ChatRequestSchema = z.object({
  sme_id: z.string().uuid().or(z.string().min(1)), // Support both UUIDs and strings like 'sme_choplife_001'
  user_id: z.string().min(1),
  message: z.string().min(1).max(2000)
});

export const ClearSessionRequestSchema = z.object({
  sme_id: z.string().min(1),
  user_id: z.string().min(1)
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ClearSessionRequest = z.infer<typeof ClearSessionRequestSchema>;
