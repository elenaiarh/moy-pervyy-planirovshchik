import crypto from "node:crypto";
import { db } from "./database.js";
import { hashPassword } from "./auth.js";

const login = String(process.argv[2] || "").trim();
const password = String(process.argv[3] || "");

if (!login || !password) {
  process.stderr.write("Использование: npm run create-user -- <login> <password>\n");
  process.exit(1);
}

if (password.length < 10) {
  process.stderr.write("Пароль должен быть не короче 10 символов.\n");
  process.exit(1);
}

const existing = db.prepare("SELECT id FROM users WHERE login = ?").get(login);

if (existing) {
  process.stderr.write(`Пользователь "${login}" уже существует.\n`);
  process.exit(1);
}

db.prepare(`
  INSERT INTO users (id, login, password_hash)
  VALUES (?, ?, ?)
`).run(crypto.randomUUID(), login, hashPassword(password));

process.stdout.write(`Пользователь "${login}" создан.\n`);
