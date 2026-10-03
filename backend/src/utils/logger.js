// Centralised structured logging.
//
// Replaces bare console.log/console.error, which disappear the moment the
// process restarts on most hosting platforms (Render/Railway free tiers,
// PM2 restarts, container recreation). Logs are written to rotating files
// under backend/logs AND still printed to the console (so `npm run dev`
// output is unchanged), so you always have at least a few days of history
// on disk to look back at after something goes wrong.
//
// This does NOT replace a real external monitoring tool (Sentry, Logtail,
// Datadog, etc.) — it's the "at least we have something" baseline. Plugging
// in an external service later is just adding another Winston transport
// here; nothing else in the codebase needs to change since every controller
// already imports this one logger.
const path = require("path");
const fs = require("fs");
const winston = require("winston");
require("winston-daily-rotate-file");

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "..", "..", "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const isProd = process.env.NODE_ENV === "production";

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}: ${stack || message}${extra}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  format: fileFormat,
  defaultMeta: { service: "teacherhub-backend" },
  transports: [
    new winston.transports.DailyRotateFile({
      dirname: LOG_DIR,
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "30d",
      maxSize: "20m",
    }),
    new winston.transports.DailyRotateFile({
      dirname: LOG_DIR,
      filename: "combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      maxSize: "20m",
    }),
  ],
  exitOnError: false,
});

// Always also log to the console (dev AND prod) — most hosts capture stdout
// into their own dashboard even when the disk itself is ephemeral, so this
// is a second, free copy of the logs.
logger.add(
  new winston.transports.Console({
    format: isProd ? fileFormat : consoleFormat,
  })
);

module.exports = logger;
