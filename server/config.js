import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ quiet: true });

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, "..");

function numberFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) ? value : fallback;
}

function booleanFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export const config = {
  projectRoot,
  env: process.env.NODE_ENV || "development",
  host: process.env.ASSIYA_HOST || "127.0.0.1",
  port: numberFromEnv("ASSIYA_PORT", 3020),
  dbPath: process.env.ASSIYA_DB_PATH || path.join(projectRoot, "data", "assiya.sqlite"),
  uploadsDir: process.env.ASSIYA_UPLOADS_DIR || path.join(projectRoot, "data", "uploads"),
  backupDir: process.env.ASSIYA_BACKUP_DIR || path.join(projectRoot, "data", "backups"),
  backupKeep: numberFromEnv("ASSIYA_BACKUP_KEEP", 30),
  cookieName: "assiya_session",
  cookieSecure: booleanFromEnv("ASSIYA_COOKIE_SECURE", process.env.NODE_ENV === "production"),
  sessionDays: numberFromEnv("ASSIYA_SESSION_DAYS", 180),
  loginWindowMinutes: numberFromEnv("ASSIYA_LOGIN_WINDOW_MINUTES", 15),
  loginMaxFailures: numberFromEnv("ASSIYA_LOGIN_MAX_FAILURES", 5),
  vapidPublicKey: process.env.ASSIYA_VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.ASSIYA_VAPID_PRIVATE_KEY || "",
  vapidSubject: process.env.ASSIYA_VAPID_SUBJECT || "mailto:admin@localhost",
  notificationTimezone: process.env.ASSIYA_NOTIFICATION_TIMEZONE || "Europe/Kirov",
  pushIntervalMs: numberFromEnv("ASSIYA_PUSH_INTERVAL_MS", 60000),
};
