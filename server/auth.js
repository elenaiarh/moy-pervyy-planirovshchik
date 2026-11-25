import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { config } from "./config.js";
import { db, nowISO } from "./database.js";

const sessionSelect = db.prepare(`
  SELECT sessions.id, sessions.user_id, sessions.expires_at, users.login
  FROM sessions
  JOIN users ON users.id = sessions.user_id
  WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')
`);

const sessionInsert = db.prepare(`
  INSERT INTO sessions (id, user_id, token_hash, user_agent, ip_address, expires_at)
  VALUES (@id, @userId, @tokenHash, @userAgent, @ipAddress, @expiresAt)
`);

const sessionDeleteByHash = db.prepare("DELETE FROM sessions WHERE token_hash = ?");
const sessionDeleteExpired = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')");

const userByLogin = db.prepare("SELECT * FROM users WHERE login = ?");

const failedAttempts = db.prepare(`
  SELECT COUNT(*) AS count
  FROM login_attempts
  WHERE success = 0
    AND (login = @login OR ip_address = @ipAddress)
    AND created_at >= datetime('now', @window)
`);

const attemptInsert = db.prepare(`
  INSERT INTO login_attempts (login, ip_address, success)
  VALUES (@login, @ipAddress, @success)
`);

export function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compareSync(password, passwordHash);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) return [part, ""];
        return [part.slice(0, separatorIndex), decodeURIComponent(part.slice(separatorIndex + 1))];
      }),
  );
}

export function makeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push("Path=/");
  parts.push("HttpOnly");
  parts.push("SameSite=Lax");
  if (options.secure) parts.push("Secure");
  if (options.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  return parts.join("; ");
}

export function getRequestIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "";
}

export function isLoginLimited(login, ipAddress) {
  const row = failedAttempts.get({
    login,
    ipAddress,
    window: `-${config.loginWindowMinutes} minutes`,
  });
  return Number(row?.count || 0) >= config.loginMaxFailures;
}

export function recordLoginAttempt(login, ipAddress, success) {
  attemptInsert.run({ login, ipAddress, success: success ? 1 : 0 });
}

export function createSession(user, req) {
  sessionDeleteExpired.run();

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);

  sessionInsert.run({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash: hashToken(token),
    userAgent: req.headers["user-agent"] || "",
    ipAddress: getRequestIp(req),
    expiresAt: expiresAt.toISOString(),
  });

  return {
    token,
    cookie: makeCookie(config.cookieName, token, {
      secure: config.cookieSecure,
      maxAge: config.sessionDays * 24 * 60 * 60,
      expires: expiresAt,
    }),
  };
}

export function clearSessionCookie() {
  return makeCookie(config.cookieName, "", {
    secure: config.cookieSecure,
    maxAge: 0,
    expires: new Date(0),
  });
}

export function destroySession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[config.cookieName];
  if (token) sessionDeleteByHash.run(hashToken(token));
}

export function getUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[config.cookieName];
  if (!token) return null;

  const session = sessionSelect.get(hashToken(token));
  if (!session) return null;

  return {
    id: session.user_id,
    login: session.login,
    sessionId: session.id,
    authenticatedAt: nowISO(),
  };
}

export function requireAuth(req, res, next) {
  const user = getUserFromRequest(req);
  if (!user) {
    if (req.path.startsWith("/api/")) {
      res.status(401).json({ error: "auth_required" });
      return;
    }

    res.redirect("/login");
    return;
  }

  req.user = user;
  next();
}

export function findUserByLogin(login) {
  return userByLogin.get(login);
}
