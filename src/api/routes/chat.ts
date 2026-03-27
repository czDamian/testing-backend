import { Router, Request, Response } from "express";
import { ChatRequestSchema, ClearSessionRequestSchema } from "../schemas/chatSchema.js";
import { runChat } from "../../ai/chains/chatChain.js";
import { clearSession } from "../../db/repos/sessionRepo.js";
import log from "../../logger.js";

const router = Router();

/**
 * Main chat endpoint.
 * Customer sends a message, AI responds using tools if needed.
 */
router.post("/chat", async (req: Request, res: Response) => {
  const result = ChatRequestSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors });
    return;
  }

  const { sme_id, user_id, message } = result.data;

  try {
    const chatResult = await runChat(sme_id, user_id, message);
    res.json({
      reply: chatResult.reply,
      order_placed: chatResult.orderPlaced
    });
  } catch (err: any) {
    log.error({ msg: "chat_endpoint_error", smeId: sme_id, error: err.message });
    res.status(500).json({ error: "Assistant temporarily unavailable." });
  }
});

/**
 * Clear session endpoint.
 * Call when a user logs out or starts a fresh conversation.
 */
router.delete("/chat/session", async (req: Request, res: Response) => {
  const result = ClearSessionRequestSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors });
    return;
  }

  const { sme_id, user_id } = result.data;

  try {
    await clearSession(sme_id, user_id);
    res.json({ message: "Session cleared." });
  } catch (err: any) {
    log.error({ msg: "clear_session_error", smeId: sme_id, error: err.message });
    res.status(500).json({ error: "Could not clear session." });
  }
});

export default router;
