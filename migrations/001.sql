CREATE TABLE users (
  id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin','editor')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL
);
CREATE INDEX session_expiry ON sessions(expires);
CREATE TABLE categories (
  id TEXT PRIMARY KEY, position INTEGER NOT NULL, content TEXT NOT NULL CHECK(json_valid(content)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE media (
  id TEXT PRIMARY KEY, mime TEXT NOT NULL CHECK(mime = 'image/webp'), bytes BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK(kind IN ('service','price','partner','project','team','banner')),
  category TEXT REFERENCES categories(id), position INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0,1)),
  image TEXT REFERENCES media(id), content TEXT NOT NULL CHECK(json_valid(content)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((kind IN ('service','price') AND category IS NOT NULL) OR (kind NOT IN ('service','price') AND category IS NULL))
);
CREATE INDEX entry_listing ON entries(kind, category, visible, position, id);
CREATE TABLE settings (
  key TEXT PRIMARY KEY, content TEXT NOT NULL CHECK(json_valid(content)),
  image TEXT REFERENCES media(id), logo TEXT REFERENCES media(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL, phone TEXT NOT NULL, category TEXT NOT NULL REFERENCES categories(id), message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','closed')),
  telegram TEXT NOT NULL DEFAULT 'pending' CHECK(telegram IN ('pending','sending','failed','sent')),
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lead_status ON leads(status, id DESC);
CREATE INDEX telegram_queue ON leads(telegram, next_attempt);
CREATE TABLE limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX limit_expiry ON limits(expires);
