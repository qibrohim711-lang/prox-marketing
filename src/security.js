import { createHash, createHmac, randomBytes, randomInt, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const secret = randomBytes(32);
const sign = (value) => createHmac('sha256', secret).update(value).digest('base64url');
export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('hex');
const cookieName = 'prox_session';

export function secureEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function hashPassword(password) {
  const salt = randomBytes(24).toString('hex');
  const key = await derive(password, salt, 64);
  return salt + ':' + key.toString('hex');
}

export async function checkPassword(password, hash) {
  const [salt, key] = hash?.split(':') ?? ['0'.repeat(48), '0'.repeat(128)];
  return secureEqual((await derive(password, salt, 64)).toString('hex'), key) && !!hash;
}

export function getSession(db, req) {
  const raw = req.headers.cookie?.match(/(?:^|;\s*)prox_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!raw) return null;
  const token = digest(raw);
  const user = db.prepare('SELECT users.id, users.email, users.role FROM sessions JOIN users ON sessions.user_id=users.id WHERE sessions.token=? AND expires>?').get(token, Date.now());
  return user && { ...user, token, csrf: sign('admin:' + token) };
}

export function sessionCookie(value, age, secure) {
  return cookieName + '=' + value + '; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=' + age + (secure ? '; Secure' : '');
}

export function challenge() {
  const id = randomUUID();
  const expires = Date.now() + 30 * 60_000;
  const a = randomInt(2, 10);
  const b = randomInt(2, 10);
  return { id, expires, a, b, signature: sign([id, expires, a + b].join(':')) };
}

export function verifyChallenge(form) {
  const id = form.get('requestId') ?? '';
  const expires = Number(form.get('expires'));
  const answer = (form.get('answer') ?? '').trim();
  return validRequestId(id) && Number.isSafeInteger(expires) && Date.now() < expires &&
    /^\d{1,2}$/.test(answer) && secureEqual(sign([id, expires, Number(answer)].join(':')), form.get('signature') ?? '');
}

export const validRequestId = (value) => /^[a-f0-9-]{36}$/.test(value);

export function rateLimit(db, key, maximum, windowMs) {
  const now = Date.now();
  const row = db.prepare(`INSERT INTO limits(key,count,expires) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,
    expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count`).get(digest(key), now + windowMs, now, now);
  return row.count <= maximum;
}

export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function readForm(req, max = 24_000) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded') {
    throw new RequestError(415, 'Unsupported form encoding.');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > max) {
      req.resume();
      throw new RequestError(413, 'The form exceeds the upload limit.');
    }
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
}
