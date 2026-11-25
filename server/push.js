import webPush from "web-push";
import crypto from "node:crypto";
import { config } from "./config.js";
import { db } from "./database.js";

const pushConfigured = Boolean(config.vapidPublicKey && config.vapidPrivateKey);

if (pushConfigured) {
  webPush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
}

const upsertSubscription = db.prepare(`
  INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, updated_at)
  VALUES (@id, @userId, @endpoint, @p256dh, @auth, @userAgent, CURRENT_TIMESTAMP)
  ON CONFLICT(endpoint) DO UPDATE SET
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    updated_at = CURRENT_TIMESTAMP
`);

const deleteSubscriptionByEndpoint = db.prepare(`
  DELETE FROM push_subscriptions
  WHERE endpoint = ? AND user_id = ?
`);

const deleteSubscriptionById = db.prepare(`
  DELETE FROM push_subscriptions
  WHERE id = ?
`);

const listSubscriptionsForUser = db.prepare(`
  SELECT id, endpoint, p256dh, auth
  FROM push_subscriptions
  WHERE user_id = ?
`);

const dueTasks = db.prepare(`
  SELECT id, user_id, title, client, reminder_at, snoozed_until
  FROM tasks
  WHERE reminder_at IS NOT NULL
    AND reminder_at != ''
    AND reminder_done = 0
    AND COALESCE(NULLIF(snoozed_until, ''), reminder_at) <= @nowLocal
    AND (@userId IS NULL OR user_id = @userId)
  ORDER BY COALESCE(NULLIF(snoozed_until, ''), reminder_at) ASC
  LIMIT 25
`);

const markReminderDone = db.prepare(`
  UPDATE tasks
  SET reminder_done = 1,
      snoozed_until = NULL,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = ?
`);

export function isPushConfigured() {
  return pushConfigured;
}

export function getPublicPushConfig() {
  return {
    configured: pushConfigured,
    publicKey: pushConfigured ? config.vapidPublicKey : "",
    timezone: config.notificationTimezone,
  };
}

export function savePushSubscription(userId, subscription, userAgent = "") {
  const normalized = normalizeSubscription(subscription);
  upsertSubscription.run({
    id: crypto.randomUUID(),
    userId,
    endpoint: normalized.endpoint,
    p256dh: normalized.keys.p256dh,
    auth: normalized.keys.auth,
    userAgent,
  });
}

export function deletePushSubscription(userId, subscription) {
  const endpoint = typeof subscription?.endpoint === "string" ? subscription.endpoint : "";
  if (!endpoint) return;
  deleteSubscriptionByEndpoint.run(endpoint, userId);
}

export async function sendDuePushNotifications({ userId = null } = {}) {
  if (!pushConfigured) return { sent: 0, due: 0, disabled: true };

  const nowLocal = formatInConfiguredTimezone(new Date());
  const tasks = dueTasks.all({ nowLocal, userId });
  let sent = 0;

  for (const task of tasks) {
    const subscriptions = listSubscriptionsForUser.all(task.user_id);
    if (!subscriptions.length) continue;

    const payload = JSON.stringify({
      title: "АССИЯ напоминает",
      body: `${task.title}${task.client ? ` · ${task.client}` : ""}`,
      url: "/",
      taskId: task.id,
      reminderAt: task.snoozed_until || task.reminder_at,
    });

    const results = await Promise.allSettled(
      subscriptions.map((subscription) => sendToSubscription(subscription, payload)),
    );

    const successCount = results.filter((result) => result.status === "fulfilled" && result.value === "sent").length;
    sent += successCount;

    if (successCount > 0) {
      markReminderDone.run(task.id);
    }
  }

  return { sent, due: tasks.length, disabled: false };
}

async function sendToSubscription(row, payload) {
  const subscription = {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };

  try {
    await webPush.sendNotification(subscription, payload);
    return "sent";
  } catch (error) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      deleteSubscriptionById.run(row.id);
      return "expired";
    }

    throw error;
  }
}

function normalizeSubscription(subscription) {
  const endpoint = typeof subscription?.endpoint === "string" ? subscription.endpoint : "";
  const p256dh = typeof subscription?.keys?.p256dh === "string" ? subscription.keys.p256dh : "";
  const auth = typeof subscription?.keys?.auth === "string" ? subscription.keys.auth : "";

  if (!endpoint || !p256dh || !auth) {
    throw new Error("invalid_push_subscription");
  }

  return { endpoint, keys: { p256dh, auth } };
}

function formatInConfiguredTimezone(date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: config.notificationTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
