import app from "./app.js";
import { settings } from "./config.js";
import log from "./logger.js";

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
  } catch (err: any) {
    log.error({ msg: "server_startup_failed", error: err.message });
    process.exit(1);
  }
}

start();
