import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { db } from "./database.js";

const BACKUP_FILE_PATTERN = /^assiya-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.sqlite$/;

export async function createBackup() {
  fs.mkdirSync(config.backupDir, { recursive: true });

  const fileName = backupFileName();
  const backupPath = path.join(config.backupDir, fileName);

  if (typeof db.backup === "function") {
    await db.backup(backupPath);
  } else {
    db.pragma("wal_checkpoint(TRUNCATE)");
    fs.copyFileSync(config.dbPath, backupPath);
  }

  pruneBackups();

  return backupInfo(fileName);
}

export function listBackups() {
  fs.mkdirSync(config.backupDir, { recursive: true });

  return fs
    .readdirSync(config.backupDir)
    .filter((fileName) => BACKUP_FILE_PATTERN.test(fileName))
    .map(backupInfo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function resolveBackupPath(fileName) {
  if (!BACKUP_FILE_PATTERN.test(fileName)) {
    return "";
  }

  const backupPath = path.join(config.backupDir, fileName);
  if (!isPathInside(config.backupDir, backupPath) || !fs.existsSync(backupPath)) {
    return "";
  }

  return backupPath;
}

function backupFileName(date = new Date()) {
  return `assiya-${date.toISOString().replaceAll(":", "-").replaceAll(".", "-")}.sqlite`;
}

function backupInfo(fileName) {
  const backupPath = path.join(config.backupDir, fileName);
  const stat = fs.statSync(backupPath);

  return {
    fileName,
    sizeBytes: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
}

function pruneBackups() {
  const keep = Math.max(1, config.backupKeep);
  const backups = listBackups();

  backups.slice(keep).forEach((backup) => {
    const backupPath = resolveBackupPath(backup.fileName);
    if (backupPath) {
      fs.unlinkSync(backupPath);
    }
  });
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}
