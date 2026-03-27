import app from "./app.js";
import { settings } from "./config.js";
import log from "./logger.js";
import { startBot } from "./telegram/bot.js";

const port = settings.appPort;

/**
 * Startup loop.
 * We can add pre-start checks here (DB connectivity, etc.)
 */
async function start() {
  try {
    app.listen(port, () => {
      log.info({
        msg: "SmartBiz AI Server Started",
        port,
        env: settings.appEnv,
        urls: [`http://0.0.0.0:${port}/health`]
      });
    });

    log.info({ msg: "starting_telegram_bot_service" });
    
    // Start the bot daemon concurrently with the Express server
    startBot().catch((err: any) => {
      log.fatal({ msg: "telegram_bot_service_failed", error: err.message });
      process.exit(1);
    });

  } catch (err: any) {
    log.error({ msg: "server_startup_failed", error: err.message });
    process.exit(1);
  }
}

start();
