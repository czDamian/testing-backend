import pino from "pino";
import { settings } from "./config.js";

const log = pino({
  level: "debug",
  transport:
    settings.appEnv === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export default log;
