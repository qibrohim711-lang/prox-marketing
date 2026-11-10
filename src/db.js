import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { seed } from './seed.js';

export function openDb(path = process.env.DATABASE_PATH || 'data/prox.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec('CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)');
  transaction(db, () => {
    if (db.prepare('SELECT 1 FROM migrations WHERE version = 1').get()) return;
    db.exec(readFileSync(new URL('../migrations/001.sql', import.meta.url), 'utf8'));
    seed(db);
    db.prepare('INSERT INTO migrations(version) VALUES (1)').run();
  });
  return db;
}

export function transaction(db, run) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = run();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function readContent(db) {
  const decode = (row) => ({ ...row, content: JSON.parse(row.content) });
  const categories = db.prepare('SELECT * FROM categories ORDER BY position').all().map(decode);
  const settings = Object.fromEntries(db.prepare('SELECT * FROM settings').all().map(row => [row.key, decode(row)]));
  const entries = db.prepare('SELECT * FROM entries ORDER BY position,id').all().map(decode);
  return { categories, settings, entries };
}

export function purgeOrphanMedia(db) {
  db.exec(`DELETE FROM media WHERE NOT EXISTS (SELECT 1 FROM entries WHERE image = media.id)
    AND NOT EXISTS (SELECT 1 FROM settings WHERE image = media.id OR logo = media.id)`);
}
