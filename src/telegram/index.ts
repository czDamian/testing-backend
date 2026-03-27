import { startBot } from "./bot.js";
import log from "../logger.js";

log.info({ msg: "starting_telegram_bot_service" });

startBot().catch((err: any) => {
  log.fatal({ msg: "telegram_bot_service_failed", error: err.message });
  process.exit(1);
});
