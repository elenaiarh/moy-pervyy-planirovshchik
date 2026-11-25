import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(config.backupDir, { recursive: true });

export const db = new Database(config.dbPath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

const schemaPath = path.join(config.projectRoot, "server", "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

db.exec(schema);

export function nowISO() {
  return new Date().toISOString();
}
