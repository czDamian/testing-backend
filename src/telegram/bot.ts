import { Telegraf } from "telegraf";
import { settings } from "../config.js";
import { getTelegramUser, upsertTelegramUser } from "../db/repos/userRepo.js";
import { runMarketplaceAgent } from "./agent.js";
import { runChat } from "../ai/chains/chatChain.js";
import { getSmeById } from "../db/repos/smeRepo.js";
import log from "../logger.js";

if (!process.env["TELEGRAM_BOT_TOKEN"]) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN in environment");
}

const bot = new Telegraf(process.env["TELEGRAM_BOT_TOKEN"]);

/**
 * Middleware to ensure the user is "locked" to an SME.
 * If not, it runs the discovery router.
 */
/**
 * Convert Claude's markdown into Telegram-compatible HTML.
 */
function formatTelegramHTML(text: string) {
  let html = text
    // Replace markdown links [text](url) with HTML <a href="url">text</a>
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    // Replace **bold** with <b>bold</b>
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    // Replace *italic* with <i>italic</i>
    .replace(/\*(.*?)\*/g, '<i>$1</i>');
  return html;
}

bot.on("text", async (ctx) => {
  const userId = String(ctx.from.id);
  const text = ctx.message.text;

  // 1. Handle commands
  if (text === "/start" || text === "/reset" || text === "/discover") {
    await upsertTelegramUser(userId, null);
    return ctx.replyWithHTML(formatTelegramHTML("Welcome to SmartBiz! 🛍️\n\nWhat are you looking for today? (e.g. 'I want to buy food', 'I need a laundry service')"));
  }

  try {
    // 2. Check for active SME lock
    let user = await getTelegramUser(userId);
    let smeId = user?.activeSmeId;

    if (!smeId) {
      // 3. Discovery Phase - Run the "Thinking" Agent
      const result = await runMarketplaceAgent(userId, text);
      await ctx.replyWithHTML(formatTelegramHTML(result.reply));

      // If the agent selected a business, the user is now locked for the NEXT message.
      return;
    }

    // 5. Normal Chat Phase (User is locked)
    ctx.sendChatAction("typing");
    const { reply } = await runChat(smeId, userId, text);
    await ctx.replyWithHTML(formatTelegramHTML(reply));

  } catch (err: any) {
    log.error({ msg: "bot_handler_error", userId, error: err.message });
    await ctx.reply("Sorry, I'm having a bit of trouble right now. Please try again later.");
  }
});

/**
 * Start the bot
 */
export async function startBot() {
  bot.launch();
  log.info({ msg: "telegram_bot_launched" });

  // Enable graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
