import { createBackup } from "./backup.js";

try {
  const backup = await createBackup();
  process.stdout.write(`Backup создан: ${backup.fileName} (${backup.sizeBytes} байт)\n`);
} catch (error) {
  process.stderr.write(`Не удалось создать backup: ${error.message}\n`);
  process.exitCode = 1;
}
