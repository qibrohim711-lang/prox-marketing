import { openDb, transaction } from './db.js';
import { hashPassword } from './security.js';

const email = process.env.PROX_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
const password = process.env.PROX_ADMIN_PASSWORD ?? '';
const role = process.env.PROX_ADMIN_ROLE || 'admin';
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
    password.length < 14 || password.length > 128 || !['admin', 'editor'].includes(role)) {
  console.error('Set PROX_ADMIN_EMAIL, PROX_ADMIN_ROLE (admin or editor) and a 14–128 character PROX_ADMIN_PASSWORD.');
  process.exit(1);
}
const db = openDb();
const hash = await hashPassword(password);
transaction(db, () => {
  db.prepare(`INSERT INTO users(email,password,role) VALUES (?,?,?)
    ON CONFLICT(email) DO UPDATE SET password=excluded.password, role=excluded.role, updated_at=CURRENT_TIMESTAMP`).run(email, hash, role);
  db.prepare('DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)').run(email);
});
db.close();
console.log('Account saved and previous sessions revoked.');
