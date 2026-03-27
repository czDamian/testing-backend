import express from "express";
import cors from "cors";
import chatRouter from "./api/routes/chat.js";
import ordersRouter from "./api/routes/orders.js";
import { settings } from "./config.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/v1", chatRouter);
app.use("/api/v1", ordersRouter);

/**
 * Health check endpoint.
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", env: settings.appEnv });
});

export default app;
