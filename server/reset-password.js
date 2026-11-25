import { db } from "./database.js";
import { hashPassword } from "./auth.js";

const login = String(process.argv[2] || "").trim();

if (!login) {
  process.stderr.write("Укажи логин пользователя\n");
  process.exit(1);
}

let password = "";
process.stdin.setEncoding("utf8");

for await (const chunk of process.stdin) {
  password += chunk;
  if (password.length > 1024) {
    process.stderr.write("Пароль слишком длинный\n");
    process.exit(1);
  }
}

if (password.length < 10) {
  process.stderr.write("Пароль должен быть не короче 10 символов\n");
  process.exit(1);
}

const user = db.prepare("SELECT id FROM users WHERE login = ?").get(login);

if (!user) {
  process.stderr.write(`Пользователь "${login}" не найден\n`);
  process.exit(1);
}

const updatePassword = db.transaction(() => {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), user.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
});

updatePassword();
password = "";

process.stdout.write(`Пароль пользователя "${login}" изменён. Старые сессии завершены.\n`);
