import { prisma } from "../prisma.js";
import log from "../../logger.js";
import type { TelegramUser } from "@prisma/client";

export type { TelegramUser }; // Re-export for compatibility with other files

/** Fetch a Telegram user by their ID. Returns null if not found. */
export async function getTelegramUser(userId: string): Promise<TelegramUser | null> {
  try {
    return await prisma.telegramUser.findUnique({
      where: { id: userId }
    });
  } catch (error: any) {
    log.error({ msg: "get_telegram_user_failed", userId, error: error.message });
    return null;
  }
}

/** Update or create a Telegram user session "lock" to an SME. */
export async function upsertTelegramUser(userId: string, smeId: string | null): Promise<void> {
  try {
    await prisma.telegramUser.upsert({
      where: { id: userId },
      update: { activeSmeId: smeId },
      create: { id: userId, activeSmeId: smeId }
    });
  } catch (error: any) {
    log.error({ msg: "upsert_telegram_user_failed", userId, smeId, error: error.message });
    throw new Error(`Failed to update Telegram user session: ${error.message}`);
  }
}

/** Clear the active SME for a user (Discovery Mode). */
export async function resetTelegramUser(userId: string): Promise<void> {
  await upsertTelegramUser(userId, null);
}
