import { prisma } from "../prisma.js";
import log from "../../logger.js";

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_MESSAGES = 20; // keep last 10 turns (20 messages)

function sessionId(smeId: string, userId: string): string {
  return `${smeId}:${userId}`;
}

/** Returns the conversation history for a session. Returns [] if none exists. */
export async function getHistory(smeId: string, userId: string): Promise<SessionMessage[]> {
  try {
    const session = await prisma.telegramSession.findUnique({
      where: { smeId_userId: { smeId, userId } }
    });

    if (!session || !session.messages) return [];
    return session.messages as unknown as SessionMessage[];
  } catch (err: any) {
    return [];
  }
}

/**
 * Appends a user + assistant turn to the session and trims to MAX_MESSAGES.
 * Uses upsert so the first message automatically creates the row.
 */
export async function appendMessages(
  smeId: string,
  userId: string,
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  const id = sessionId(smeId, userId);
  const history = await getHistory(smeId, userId);

  history.push({ role: "user", content: userMessage });
  history.push({ role: "assistant", content: assistantMessage });

  const trimmed = history.length > MAX_MESSAGES ? history.slice(-MAX_MESSAGES) : history;

  try {
    await prisma.telegramSession.upsert({
      where: { smeId_userId: { smeId, userId } },
      update: { messages: trimmed as any },
      create: { id, smeId, userId, messages: trimmed as any }
    });
    log.debug({ msg: "session.updated", smeId, userId, messages: trimmed.length });
  } catch (error: any) {
    log.error({ msg: "session.append.failed", smeId, userId, error: error.message });
  }
}

/** Deletes a session row entirely. */
export async function clearSession(smeId: string, userId: string): Promise<void> {
  try {
    await prisma.telegramSession.delete({
      where: { smeId_userId: { smeId, userId } }
    });
    log.info({ msg: "session.cleared", smeId, userId });
  } catch (error: any) {
    // Session might already be missing
  }
}
