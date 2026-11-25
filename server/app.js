import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { createBackup, listBackups, resolveBackupPath } from "./backup.js";
import { db } from "./database.js";
import {
  deletePushSubscription,
  getPublicPushConfig,
  isPushConfigured,
  savePushSubscription,
  sendDuePushNotifications,
} from "./push.js";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  findUserByLogin,
  getRequestIp,
  getUserFromRequest,
  isLoginLimited,
  recordLoginAttempt,
  requireAuth,
  verifyPassword,
} from "./auth.js";

const app = express();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, config.uploadsDir),
    filename: (_req, file, callback) => {
      const extension = safeExtension(file.originalname);
      callback(null, `${crypto.randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (isAllowedAttachment(file)) {
      callback(null, true);
      return;
    }

    callback(new Error("unsupported_file_type"));
  },
});

app.disable("x-powered-by");
app.set("trust proxy", "loopback");

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "5mb" }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "assiya" });
});

app.get("/login", (req, res) => {
  const user = getUserFromRequest(req);
  if (user) {
    res.redirect("/");
    return;
  }

  res.type("html").send(LoginPage());
});

app.post("/api/auth/login", (req, res) => {
  const login = String(req.body?.login || "").trim();
  const password = String(req.body?.password || "");
  const ipAddress = getRequestIp(req);

  if (!login || !password) {
    recordLoginAttempt(login || "-", ipAddress, false);
    res.status(400).json({ error: "login_and_password_required" });
    return;
  }

  if (isLoginLimited(login, ipAddress)) {
    res.status(429).json({ error: "too_many_attempts" });
    return;
  }

  const user = findUserByLogin(login);
  const isValid = user ? verifyPassword(password, user.password_hash) : false;

  recordLoginAttempt(login, ipAddress, isValid);

  if (!isValid) {
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  const session = createSession(user, req);
  res.setHeader("Set-Cookie", session.cookie);
  res.json({ ok: true, user: { login: user.login } });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  destroySession(req);
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: { login: req.user.login } });
});

app.get("/api/push/config", requireAuth, (_req, res) => {
  res.json(getPublicPushConfig());
});

app.post("/api/push/subscriptions", requireAuth, async (req, res) => {
  if (!isPushConfigured()) {
    res.status(503).json({ error: "push_not_configured" });
    return;
  }

  try {
    savePushSubscription(req.user.id, req.body?.subscription, req.get("user-agent") || "");
    sendDuePushNotifications({ userId: req.user.id }).catch((error) => {
      console.error("Push check failed after subscription:", error);
    });
    res.status(201).json({ ok: true });
  } catch {
    res.status(400).json({ error: "invalid_subscription" });
  }
});

app.delete("/api/push/subscriptions", requireAuth, (req, res) => {
  deletePushSubscription(req.user.id, req.body?.subscription);
  res.json({ ok: true });
});

app.get("/api/tasks", requireAuth, (req, res) => {
  res.json({ tasks: listTasks(req.user.id) });
});

app.get("/api/backups", requireAuth, (_req, res) => {
  res.json({ backups: listBackups() });
});

app.post("/api/backups", requireAuth, async (_req, res) => {
  try {
    const backup = await createBackup();
    res.status(201).json({ backup });
  } catch (error) {
    res.status(500).json({ error: "backup_failed", message: error.message });
  }
});

app.get("/api/backups/:fileName/download", requireAuth, (req, res) => {
  const backupPath = resolveBackupPath(req.params.fileName);
  if (!backupPath) {
    res.status(404).type("text").send("Not found");
    return;
  }

  res.download(backupPath, req.params.fileName);
});

app.put("/api/tasks", requireAuth, (req, res) => {
  if (!Array.isArray(req.body?.tasks)) {
    res.status(400).json({ error: "tasks_array_required" });
    return;
  }

  const tasks = req.body.tasks.map(normalizeTaskPayload);
  replaceTasks(req.user.id, tasks);
  res.json({ ok: true, tasks: listTasks(req.user.id) });
});

app.post("/api/tasks/:taskId/attachments", requireAuth, uploadAttachment, (req, res) => {
  const task = getTaskForUser.get(req.params.taskId, req.user.id);
  if (!task) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    res.status(404).json({ error: "task_not_found" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "attachment_required" });
    return;
  }

  const attachment = {
    id: crypto.randomUUID(),
    taskId: task.id,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype || "application/octet-stream",
    sizeBytes: req.file.size,
  };

  insertAttachment.run(attachment);
  res.status(201).json({ attachment: attachmentForClient(attachment) });
});

app.get("/api/attachments/:attachmentId/download", requireAuth, (req, res) => {
  const attachment = getAttachmentForUser.get(req.params.attachmentId, req.user.id);
  if (!attachment) {
    res.status(404).type("text").send("Not found");
    return;
  }

  const filePath = path.join(config.uploadsDir, attachment.stored_name);
  if (!isPathInside(config.uploadsDir, filePath) || !fs.existsSync(filePath)) {
    res.status(404).type("text").send("Not found");
    return;
  }

  res.download(filePath, attachment.original_name);
});

app.delete("/api/attachments/:attachmentId", requireAuth, (req, res) => {
  const attachment = getAttachmentForUser.get(req.params.attachmentId, req.user.id);
  if (!attachment) {
    res.status(404).json({ error: "attachment_not_found" });
    return;
  }

  deleteAttachmentById.run(attachment.id);
  const filePath = path.join(config.uploadsDir, attachment.stored_name);
  if (isPathInside(config.uploadsDir, filePath)) {
    fs.unlink(filePath, () => {});
  }

  res.json({ ok: true });
});

app.get("/favicon.svg", (_req, res) => {
  res.sendFile(path.join(config.projectRoot, "favicon.svg"));
});

["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"].forEach((iconName) => {
  app.get(`/${iconName}`, (_req, res) => {
    res.sendFile(path.join(config.projectRoot, iconName));
  });
});

app.get("/manifest.webmanifest", (_req, res) => {
  res.sendFile(path.join(config.projectRoot, "manifest.webmanifest"));
});

app.get("/sw.js", (_req, res) => {
  res.sendFile(path.join(config.projectRoot, "sw.js"));
});

app.use(requireAuth);

app.use("/src", express.static(path.join(config.projectRoot, "src"), { index: false }));

app.get("/", (_req, res) => {
  res.sendFile(path.join(config.projectRoot, "index.html"));
});

app.use((_req, res) => {
  res.status(404).type("text").send("Not found");
});

let server = null;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server = app.listen(config.port, config.host, () => {
    process.stdout.write(`АССИЯ слушает http://${config.host}:${config.port}\n`);
    startPushLoop();
  });
  server.ref();
}

export { app };

function startPushLoop() {
  if (!isPushConfigured()) {
    process.stdout.write("Web Push не настроен: добавь ASSIYA_VAPID_PUBLIC_KEY и ASSIYA_VAPID_PRIVATE_KEY.\n");
    return;
  }

  const run = () => {
    sendDuePushNotifications().catch((error) => {
      console.error("Push notification check failed:", error);
    });
  };

  run();
  windowlessSetInterval(run, config.pushIntervalMs);
}

function windowlessSetInterval(callback, intervalMs) {
  const timer = setInterval(callback, intervalMs);
  timer.unref?.();
  return timer;
}

function LoginPage() {
  const canUseSecureCookie = config.cookieSecure ? "HTTPS обязателен для входа." : "Локальный режим без Secure-cookie.";

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Вход — АССИЯ</title>
    <style>
      :root {
        --bg: #f5e6d3;
        --paper: #fff6eb;
        --text: #2b3a4a;
        --muted: #6b7a8a;
        --accent: #c4a86c;
        --overdue: #d4a090;
      }

      * { box-sizing: border-box; }

      body {
        min-height: 100vh;
        margin: 0;
        display: grid;
        place-items: center;
        padding: 24px;
        color: var(--text);
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          linear-gradient(rgba(196, 168, 108, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(196, 168, 108, 0.08) 1px, transparent 1px),
          var(--bg);
        background-size: 48px 48px;
      }

      main {
        width: min(420px, 100%);
        padding: 34px;
        border: 1px solid rgba(196, 168, 108, 0.35);
        border-radius: 24px;
        background: rgba(255, 246, 235, 0.86);
        box-shadow: 0 18px 46px rgba(43, 58, 74, 0.14);
      }

      .logo {
        width: 72px;
        height: 72px;
        margin: 0 auto 18px;
        border: 2px solid var(--text);
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-family: Georgia, serif;
        font-size: 42px;
        box-shadow: inset 0 0 0 8px rgba(196, 168, 108, 0.18);
      }

      h1 {
        margin: 0 0 8px;
        text-align: center;
        font-family: Georgia, serif;
        font-size: 36px;
      }

      p {
        margin: 0 0 24px;
        color: var(--muted);
        text-align: center;
        line-height: 1.45;
      }

      label {
        display: grid;
        gap: 7px;
        margin: 0 0 14px;
        color: var(--muted);
      }

      input {
        width: 100%;
        border: 1px solid rgba(43, 58, 74, 0.16);
        border-radius: 14px;
        padding: 13px 14px;
        font: inherit;
        color: var(--text);
        background: rgba(255, 255, 255, 0.5);
      }

      button {
        width: 100%;
        margin-top: 8px;
        border: 0;
        border-radius: 999px;
        padding: 14px 18px;
        color: #f5e6d3;
        background: var(--text);
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .error {
        min-height: 22px;
        margin-top: 14px;
        color: var(--overdue);
        text-align: center;
      }

      small {
        display: block;
        margin-top: 16px;
        color: var(--muted);
        text-align: center;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="logo">А</div>
      <h1>АССИЯ</h1>
      <p>Войди, чтобы открыть свой планировщик. Детали останутся за закрытой дверью.</p>
      <form id="login-form" method="post" action="/api/auth/login" autocomplete="on">
        <label for="login">
          Логин
          <input id="login" name="login" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="text" required />
        </label>
        <label for="password">
          Пароль
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </label>
        <button type="submit">Войти</button>
        <div class="error" id="error"></div>
      </form>
      <small>${escapeHTML(canUseSecureCookie)}</small>
    </main>
    <script>
      const form = document.querySelector("#login-form");
      const error = document.querySelector("#error");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        error.textContent = "";

        const body = new URLSearchParams(new FormData(form));
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
        });

        if (response.ok) {
          window.location.href = "/";
          return;
        }

        if (response.status === 429) {
          error.textContent = "Слишком много попыток. Давай сделаем паузу и попробуем позже.";
          return;
        }

        error.textContent = "Логин или пароль не подошли.";
      });
    </script>
  </body>
</html>`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeTaskPayload(task) {
  const category = ["work", "self", "together"].includes(task?.category) ? task.category : "self";
  const allDay = Boolean(task?.allDay);
  const start = allDay ? "00:00" : normalizeTime(task?.start) || "09:00";
  const end = allDay ? "23:59" : normalizeTime(task?.end);

  return {
    id: typeof task?.id === "string" && task.id ? task.id : crypto.randomUUID(),
    title: String(task?.title || "").trim() || "Без названия",
    description: String(task?.description || ""),
    notes: String(task?.notes || ""),
    category,
    client: category === "work" ? String(task?.client || "").trim() : "",
    date: isISODate(task?.date) ? task.date : new Date().toISOString().slice(0, 10),
    start,
    end,
    allDay,
    repeat: ["none", "weekly", "monthly"].includes(task?.repeat) ? task.repeat : "none",
    focus: ["urgentImportant", "important", "urgent", "calm"].includes(task?.focus) ? task.focus : "important",
    care: typeof task?.care === "boolean" ? task.care : true,
    reminderAt: typeof task?.reminderAt === "string" ? task.reminderAt : "",
    reminderDone: Boolean(task?.reminderDone),
    snoozedUntil: typeof task?.snoozedUntil === "string" ? task.snoozedUntil : "",
    completedDates: Array.isArray(task?.completedDates) ? task.completedDates.filter(isISODate) : [],
    recurrenceExceptionDates: Array.isArray(task?.recurrenceExceptionDates) ? task.recurrenceExceptionDates.filter(isISODate) : [],
    checklistItems: normalizeChecklistItems(task?.checklistItems),
    sourceTaskId: typeof task?.sourceTaskId === "string" ? task.sourceTaskId : "",
    createdAt: Number.isFinite(task?.createdAt) ? task.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
}

function listTasks(userId) {
  const rows = db.prepare(`
    SELECT *
    FROM tasks
    WHERE user_id = ?
    ORDER BY task_date ASC, start_time ASC, created_at ASC
  `).all(userId);

  const completedRows = db.prepare(`
    SELECT task_id, task_date
    FROM task_completed_dates
    WHERE task_id IN (${rows.map(() => "?").join(",") || "NULL"})
  `);

  const exceptionRows = db.prepare(`
    SELECT task_id, exception_date
    FROM task_recurrence_exceptions
    WHERE task_id IN (${rows.map(() => "?").join(",") || "NULL"})
  `);

  const taskIds = rows.map((row) => row.id);
  const checklistByTask = groupRows(
    taskIds.length
      ? db.prepare(`
          SELECT id, task_id, title, completed, position
          FROM task_checklist_items
          WHERE task_id IN (${rows.map(() => "?").join(",")})
          ORDER BY position ASC, created_at ASC
        `).all(...taskIds)
      : [],
  );
  const attachmentsByTask = groupRows(
    taskIds.length
      ? db.prepare(`
          SELECT id, task_id, original_name, stored_name, mime_type, size_bytes, created_at
          FROM task_attachments
          WHERE task_id IN (${rows.map(() => "?").join(",")})
          ORDER BY created_at ASC
        `).all(...taskIds)
      : [],
  );
  const completedByTask = groupDateRows(taskIds.length ? completedRows.all(...taskIds) : [], "task_date");
  const exceptionsByTask = groupDateRows(taskIds.length ? exceptionRows.all(...taskIds) : [], "exception_date");

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description || "",
    notes: row.notes || "",
    category: row.category,
    client: row.client || "",
    date: row.task_date,
    start: row.start_time || "09:00",
    end: row.end_time || "",
    allDay: Boolean(row.all_day),
    repeat: row.repeat_rule,
    focus: row.focus,
    care: Boolean(row.care),
    reminderAt: row.reminder_at || "",
    reminderDone: Boolean(row.reminder_done),
    snoozedUntil: row.snoozed_until || "",
    completedDates: completedByTask.get(row.id) || [],
    recurrenceExceptionDates: exceptionsByTask.get(row.id) || [],
    checklistItems: (checklistByTask.get(row.id) || []).map(checklistItemForClient),
    attachments: (attachmentsByTask.get(row.id) || []).map(attachmentForClient),
    sourceTaskId: row.source_task_id || "",
    createdAt: Date.parse(row.created_at) || Date.now(),
  }));
}

const replaceTasks = db.transaction((userId, tasks) => {
  const existingReminderRows = db.prepare(`
    SELECT id, reminder_at, snoozed_until, reminder_done
    FROM tasks
    WHERE user_id = ?
  `).all(userId);
  const existingReminderState = new Map(existingReminderRows.map((row) => [row.id, row]));
  const existingAttachments = db.prepare(`
    SELECT task_attachments.*
    FROM task_attachments
    JOIN tasks ON tasks.id = task_attachments.task_id
    WHERE tasks.user_id = ?
  `).all(userId);

  db.prepare("DELETE FROM tasks WHERE user_id = ?").run(userId);

  const insertTask = db.prepare(`
    INSERT INTO tasks (
      id, user_id, title, description, notes, category, client, task_date, start_time, end_time,
      all_day, repeat_rule, focus, care, reminder_at, reminder_done, snoozed_until,
      completed, completed_at, source_task_id, created_at, updated_at
    )
    VALUES (
      @id, @userId, @title, @description, @notes, @category, @client, @date, @start, @end,
      @allDay, @repeat, @focus, @care, @reminderAt, @reminderDone, @snoozedUntil,
      @completed, @completedAt, NULL, @createdAt, @updatedAt
    )
  `);

  const insertCompletedDate = db.prepare(`
    INSERT INTO task_completed_dates (task_id, task_date)
    VALUES (?, ?)
  `);

  const insertException = db.prepare(`
    INSERT INTO task_recurrence_exceptions (task_id, exception_date)
    VALUES (?, ?)
  `);

  const insertChecklistItem = db.prepare(`
    INSERT INTO task_checklist_items (id, task_id, title, completed, position)
    VALUES (@id, @taskId, @title, @completed, @position)
  `);

  const insertPreservedAttachment = db.prepare(`
    INSERT INTO task_attachments (id, task_id, original_name, stored_name, mime_type, size_bytes, created_at)
    VALUES (@id, @task_id, @original_name, @stored_name, @mime_type, @size_bytes, @created_at)
  `);

  const updateSource = db.prepare(`
    UPDATE tasks
    SET source_task_id = ?
    WHERE id = ? AND user_id = ?
  `);

  const taskIds = new Set(tasks.map((task) => task.id));

  tasks.forEach((task) => {
    const completed = task.completedDates.includes(task.date);
    const previousReminder = existingReminderState.get(task.id);
    const serverReminderWasSent =
      Boolean(previousReminder?.reminder_done) &&
      (previousReminder.reminder_at || "") === (task.reminderAt || "") &&
      (previousReminder.snoozed_until || "") === (task.snoozedUntil || "");
    insertTask.run({
      ...task,
      userId,
      allDay: task.allDay ? 1 : 0,
      care: task.care ? 1 : 0,
      reminderDone: task.reminderDone || serverReminderWasSent ? 1 : 0,
      completed: completed ? 1 : 0,
      completedAt: completed ? new Date().toISOString() : null,
      reminderAt: task.reminderAt || null,
      snoozedUntil: task.snoozedUntil || null,
      createdAt: new Date(task.createdAt || Date.now()).toISOString(),
      updatedAt: new Date(task.updatedAt || Date.now()).toISOString(),
    });

    task.completedDates.forEach((date) => insertCompletedDate.run(task.id, date));
    task.recurrenceExceptionDates.forEach((date) => insertException.run(task.id, date));
    task.checklistItems.forEach((item, index) => insertChecklistItem.run({
      id: item.id,
      taskId: task.id,
      title: item.title,
      completed: item.completed ? 1 : 0,
      position: index,
    }));
  });

  existingAttachments
    .filter((attachment) => taskIds.has(attachment.task_id))
    .forEach((attachment) => insertPreservedAttachment.run(attachment));

  tasks.forEach((task) => {
    if (task.sourceTaskId && taskIds.has(task.sourceTaskId)) {
      updateSource.run(task.sourceTaskId, task.id, userId);
    }
  });
});

const getTaskForUser = db.prepare(`
  SELECT id
  FROM tasks
  WHERE id = ? AND user_id = ?
`);

const insertAttachment = db.prepare(`
  INSERT INTO task_attachments (id, task_id, original_name, stored_name, mime_type, size_bytes)
  VALUES (@id, @taskId, @originalName, @storedName, @mimeType, @sizeBytes)
`);

const getAttachmentForUser = db.prepare(`
  SELECT task_attachments.*
  FROM task_attachments
  JOIN tasks ON tasks.id = task_attachments.task_id
  WHERE task_attachments.id = ? AND tasks.user_id = ?
`);

const deleteAttachmentById = db.prepare("DELETE FROM task_attachments WHERE id = ?");

function groupDateRows(rows, field) {
  const grouped = new Map();
  rows.forEach((row) => {
    const list = grouped.get(row.task_id) || [];
    list.push(row[field]);
    grouped.set(row.task_id, list);
  });
  return grouped;
}

function groupRows(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const list = grouped.get(row.task_id) || [];
    list.push(row);
    grouped.set(row.task_id, list);
  });
  return grouped;
}

function normalizeChecklistItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => ({
      id: typeof item?.id === "string" && item.id ? item.id : crypto.randomUUID(),
      title: String(item?.title || "").trim(),
      completed: Boolean(item?.completed),
      position: Number.isFinite(item?.position) ? item.position : index,
    }))
    .filter((item) => item.title)
    .sort((a, b) => a.position - b.position);
}

function checklistItemForClient(item) {
  return {
    id: item.id,
    title: item.title,
    completed: Boolean(item.completed),
    position: item.position,
  };
}

function attachmentForClient(attachment) {
  return {
    id: attachment.id,
    taskId: attachment.task_id || attachment.taskId,
    originalName: attachment.original_name || attachment.originalName,
    mimeType: attachment.mime_type || attachment.mimeType,
    sizeBytes: attachment.size_bytes || attachment.sizeBytes,
    createdAt: attachment.created_at || new Date().toISOString(),
    url: `/api/attachments/${attachment.id}/download`,
  };
}

function uploadAttachment(req, res, next) {
  upload.single("attachment")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    res.status(400).json({ error: error.message || "invalid_attachment" });
  });
}

function isAllowedAttachment(file) {
  const extension = safeExtension(file.originalname);
  const blocked = new Set([".exe", ".msi", ".bat", ".cmd", ".sh", ".app", ".dmg", ".pkg", ".js", ".mjs", ".cjs"]);
  if (blocked.has(extension)) return false;

  const allowedExtensions = new Set([
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".txt", ".md", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".rtf",
  ]);

  return allowedExtensions.has(extension);
}

function safeExtension(filename) {
  const extension = path.extname(String(filename || "")).toLowerCase();
  return /^[a-z0-9.]{1,12}$/.test(extension) ? extension : "";
}

function isPathInside(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function normalizeTime(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : "";
}

function isISODate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
