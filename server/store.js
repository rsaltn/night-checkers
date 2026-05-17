import { mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT_DIR = fileURLToPath(new URL("../", import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, "data");
const DB_PATH = path.join(DATA_DIR, "app.sqlite");
const LEGACY_JSON_PATH = path.join(DATA_DIR, "app-store.json");

const DEFAULT_STORE = {
  users: [],
  sessions: [],
  pendingRegistrations: [],
  pendingPasswordResets: [],
  rooms: [],
};

let queue = Promise.resolve();
let db;

function ensureColumn(database, tableName, columnName, columnDefinition) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();

  if (!columns.some((column) => column.name === columnName)) {
    database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

function ensureDatabase() {
  if (db) {
    return db;
  }

  mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      country TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      ratings_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      verified_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_registrations (
      email TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      country TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_password_resets (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      variant TEXT NOT NULL,
      visibility TEXT NOT NULL,
      status TEXT NOT NULL,
      white_user_id TEXT,
      black_user_id TEXT,
      white_skin_key TEXT,
      black_skin_key TEXT,
      white_rating_before INTEGER,
      black_rating_before INTEGER,
      state_json TEXT NOT NULL,
      move_history_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      rating_applied_at TEXT
    );
  `);
  ensureColumn(db, "rooms", "visibility", "TEXT NOT NULL DEFAULT 'private'");
  ensureColumn(db, "rooms", "white_skin_key", "TEXT");
  ensureColumn(db, "rooms", "black_skin_key", "TEXT");
  ensureColumn(db, "rooms", "white_rating_before", "INTEGER");
  ensureColumn(db, "rooms", "black_rating_before", "INTEGER");

  maybeMigrateLegacyJson(db);
  return db;
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function maybeMigrateLegacyJson(database) {
  const hasUsers = database.prepare("SELECT COUNT(*) AS count FROM users").get().count > 0;
  const hasRooms = database.prepare("SELECT COUNT(*) AS count FROM rooms").get().count > 0;

  if (hasUsers || hasRooms || !existsSync(LEGACY_JSON_PATH)) {
    return;
  }

  const legacy = parseJson(readFileSync(LEGACY_JSON_PATH, "utf8"), DEFAULT_STORE);
  writeStoreInternal(legacy, database);

  try {
    rmSync(LEGACY_JSON_PATH);
  } catch {}
}

function readStoreInternal(database = ensureDatabase()) {
  const users = database
    .prepare(
      `SELECT id, email, display_name, country, password_hash, ratings_json, created_at, verified_at
       FROM users`,
    )
    .all()
    .map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      country: row.country,
      passwordHash: row.password_hash,
      ratings: parseJson(row.ratings_json, {}),
      createdAt: row.created_at,
      verifiedAt: row.verified_at,
    }));

  const sessions = database
    .prepare(`SELECT token, user_id, created_at, expires_at FROM sessions`)
    .all()
    .map((row) => ({
      token: row.token,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }));

  const pendingRegistrations = database
    .prepare(
      `SELECT email, display_name, country, password_hash, code, expires_at, created_at
       FROM pending_registrations`,
    )
    .all()
    .map((row) => ({
      email: row.email,
      displayName: row.display_name,
      country: row.country,
      passwordHash: row.password_hash,
      code: row.code,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));

  const pendingPasswordResets = database
    .prepare(
      `SELECT email, code, expires_at, created_at
       FROM pending_password_resets`,
    )
    .all()
    .map((row) => ({
      email: row.email,
      code: row.code,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));

  const rooms = database
    .prepare(
      `SELECT code, variant, visibility, status, white_user_id, black_user_id, white_skin_key, black_skin_key, white_rating_before, black_rating_before, state_json, move_history_json, created_at, updated_at, rating_applied_at
       FROM rooms`,
    )
    .all()
    .map((row) => ({
      code: row.code,
      variant: row.variant,
      visibility: row.visibility,
      status: row.status,
      whiteUserId: row.white_user_id,
      blackUserId: row.black_user_id,
      whiteSkinKey: row.white_skin_key,
      blackSkinKey: row.black_skin_key,
      whiteRatingBefore: row.white_rating_before,
      blackRatingBefore: row.black_rating_before,
      state: parseJson(row.state_json, null),
      moveHistory: parseJson(row.move_history_json, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ratingAppliedAt: row.rating_applied_at,
    }));

  return {
    users,
    sessions,
    pendingRegistrations,
    pendingPasswordResets,
    rooms,
  };
}

function writeStoreInternal(state, database = ensureDatabase()) {
  const insertUser = database.prepare(
    `INSERT INTO users (id, email, display_name, country, password_hash, ratings_json, created_at, verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertSession = database.prepare(
    `INSERT INTO sessions (token, user_id, created_at, expires_at)
     VALUES (?, ?, ?, ?)`,
  );
  const insertPendingRegistration = database.prepare(
    `INSERT INTO pending_registrations (email, display_name, country, password_hash, code, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPendingReset = database.prepare(
    `INSERT INTO pending_password_resets (email, code, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
  );
  const insertRoom = database.prepare(
    `INSERT INTO rooms (code, variant, visibility, status, white_user_id, black_user_id, white_skin_key, black_skin_key, white_rating_before, black_rating_before, state_json, move_history_json, created_at, updated_at, rating_applied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  database.exec("BEGIN");

  try {
    database.exec(`
      DELETE FROM users;
      DELETE FROM sessions;
      DELETE FROM pending_registrations;
      DELETE FROM pending_password_resets;
      DELETE FROM rooms;
    `);

    for (const user of state.users ?? []) {
      insertUser.run(
        user.id,
        user.email,
        user.displayName,
        user.country,
        user.passwordHash,
        JSON.stringify(user.ratings ?? {}),
        user.createdAt,
        user.verifiedAt ?? null,
      );
    }

    for (const session of state.sessions ?? []) {
      insertSession.run(session.token, session.userId, session.createdAt, session.expiresAt);
    }

    for (const pending of state.pendingRegistrations ?? []) {
      insertPendingRegistration.run(
        pending.email,
        pending.displayName,
        pending.country,
        pending.passwordHash,
        pending.code,
        pending.expiresAt,
        pending.createdAt,
      );
    }

    for (const pending of state.pendingPasswordResets ?? []) {
      insertPendingReset.run(
        pending.email,
        pending.code,
        pending.expiresAt,
        pending.createdAt,
      );
    }

    for (const room of state.rooms ?? []) {
      insertRoom.run(
        room.code,
        room.variant,
        room.visibility ?? "private",
        room.status,
        room.whiteUserId ?? null,
        room.blackUserId ?? null,
        room.whiteSkinKey ?? null,
        room.blackSkinKey ?? null,
        room.whiteRatingBefore ?? null,
        room.blackRatingBefore ?? null,
        JSON.stringify(room.state),
        JSON.stringify(room.moveHistory ?? []),
        room.createdAt,
        room.updatedAt,
        room.ratingAppliedAt ?? null,
      );
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export async function readStore() {
  return readStoreInternal();
}

export async function mutateStore(mutator) {
  queue = queue.then(async () => {
    const state = readStoreInternal();
    const result = await mutator(state);
    writeStoreInternal(state);
    return result;
  });

  return queue;
}
