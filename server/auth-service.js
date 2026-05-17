import crypto from "node:crypto";
import { mutateStore, readStore } from "./store.js";
import { COUNTRIES, isSupportedCountry } from "../src/shared/countries.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const CODE_TTL_MS = 1000 * 60 * 15;
const BASE_RATING = 1200;
const RATING_VARIANTS = ["russian", "english", "international"];

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    country: user.country,
    ratings: user.ratings,
    isVerified: Boolean(user.verifiedAt),
    createdAt: user.createdAt,
  };
}

function assertEmail(email) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email address");
  }
}

function assertPassword(password) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
}

function assertDisplayName(displayName) {
  if (typeof displayName !== "string" || displayName.trim().length < 2) {
    throw new Error("Display name must be at least 2 characters");
  }
}

function assertCountry(country) {
  if (!isSupportedCountry(country)) {
    throw new Error("Choose a supported country");
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash ?? "").split(":");

  if (!salt || !expected) {
    return false;
  }

  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

function createDefaultRatings() {
  return Object.fromEntries(RATING_VARIANTS.map((variant) => [variant, BASE_RATING]));
}

function createSession(userId) {
  const createdAt = Date.now();

  return {
    token: crypto.randomBytes(32).toString("hex"),
    userId,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(createdAt + SESSION_TTL_MS).toISOString(),
  };
}

function filterExpired(store) {
  const now = Date.now();
  store.sessions = store.sessions.filter((session) => Date.parse(session.expiresAt) > now);
  store.pendingRegistrations = store.pendingRegistrations.filter(
    (entry) => Date.parse(entry.expiresAt) > now,
  );
  store.pendingPasswordResets = store.pendingPasswordResets.filter(
    (entry) => Date.parse(entry.expiresAt) > now,
  );
}

export async function requestRegistration({
  email,
  password,
  displayName,
  country,
}) {
  const normalizedEmail = normalizeEmail(email);
  assertEmail(normalizedEmail);
  assertPassword(password);
  assertDisplayName(displayName);
  assertCountry(country);

  return mutateStore(async (store) => {
    filterExpired(store);

    const existingUser = store.users.find((user) => user.email === normalizedEmail);

    if (existingUser?.verifiedAt) {
      throw new Error("User with this email already exists");
    }
    const passwordHash = hashPassword(password);
    const verifiedAt = nowIso();

    let user = existingUser;

    if (!user) {
      user = {
        id: createId("user"),
        email: normalizedEmail,
        displayName: displayName.trim(),
        country,
        passwordHash,
        ratings: createDefaultRatings(),
        createdAt: verifiedAt,
        verifiedAt,
      };

      store.users.push(user);
    } else {
      user.displayName = displayName.trim();
      user.country = country;
      user.passwordHash = passwordHash;
      user.verifiedAt = verifiedAt;
      user.ratings ||= createDefaultRatings();
    }

    store.pendingRegistrations = store.pendingRegistrations.filter((entry) => entry.email !== normalizedEmail);

    const session = createSession(user.id);
    store.sessions.push(session);

    return {
      ok: true,
      token: session.token,
      user: sanitizeUser(user),
    };
  });
}

export async function verifyRegistration({ email, code }) {
  throw new Error("Registration codes are disabled");
}

export async function login({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  assertEmail(normalizedEmail);
  assertPassword(password);

  return mutateStore(async (store) => {
    filterExpired(store);

    const user = store.users.find((entry) => entry.email === normalizedEmail);

    if (!user || !user.verifiedAt || !verifyPassword(password, user.passwordHash)) {
      throw new Error("Invalid email or password");
    }

    const session = createSession(user.id);
    store.sessions.push(session);

    return {
      ok: true,
      token: session.token,
      user: sanitizeUser(user),
    };
  });
}

export async function logout(token) {
  if (!token) {
    return { ok: true };
  }

  return mutateStore(async (store) => {
    store.sessions = store.sessions.filter((session) => session.token !== token);
    return { ok: true };
  });
}

export async function requestPasswordReset({ email }) {
  const normalizedEmail = normalizeEmail(email);
  assertEmail(normalizedEmail);

  return mutateStore(async (store) => {
    filterExpired(store);

    const user = store.users.find((entry) => entry.email === normalizedEmail);

    if (!user?.verifiedAt) {
      return { ok: true };
    }

    const code = createCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    store.pendingPasswordResets = store.pendingPasswordResets.filter(
      (entry) => entry.email !== normalizedEmail,
    );

    store.pendingPasswordResets.push({
      email: normalizedEmail,
      code,
      expiresAt,
      createdAt: nowIso(),
    });

    const delivery = await sendEmailCode({
      email: normalizedEmail,
      subject: "Night Checkers reset code",
      heading: "Reset your Night Checkers password",
      intro: "Use this code to reset your password:",
      code,
      expiryMinutes: 15,
    });

    return {
      ok: true,
      delivery: delivery.delivery,
    };
  });
}

export async function resetPassword({ email, code, newPassword }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = String(code ?? "").trim();
  assertEmail(normalizedEmail);
  assertPassword(newPassword);

  return mutateStore(async (store) => {
    filterExpired(store);

    const user = store.users.find((entry) => entry.email === normalizedEmail);
    const pending = store.pendingPasswordResets.find((entry) => entry.email === normalizedEmail);

    if (!user || !pending) {
      throw new Error("Reset request expired or not found");
    }

    if (pending.code !== normalizedCode) {
      throw new Error("Invalid reset code");
    }

    user.passwordHash = hashPassword(newPassword);
    store.pendingPasswordResets = store.pendingPasswordResets.filter(
      (entry) => entry.email !== normalizedEmail,
    );
    store.sessions = store.sessions.filter((session) => session.userId !== user.id);

    const session = createSession(user.id);
    store.sessions.push(session);

    return {
      ok: true,
      token: session.token,
      user: sanitizeUser(user),
    };
  });
}

export async function requireUserByToken(token) {
  const normalizedToken = String(token ?? "").trim();

  if (!normalizedToken) {
    throw new Error("Authentication required");
  }

  const store = await readStore();
  filterExpired(store);

  const session = store.sessions.find((entry) => entry.token === normalizedToken);

  if (!session) {
    throw new Error("Session expired");
  }

  const user = store.users.find((entry) => entry.id === session.userId);

  if (!user) {
    throw new Error("User not found");
  }

  return sanitizeUser(user);
}

export async function getPublicMeta() {
  return {
    countries: COUNTRIES,
  };
}
