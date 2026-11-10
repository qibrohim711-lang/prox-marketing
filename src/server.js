import { makeServer } from './app.js';
import { openDb } from './db.js';

const { HOST = '127.0.0.1', PORT = '3000', SITE_URL = 'http://localhost:'+PORT, TRUST_PROXY,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
if (process.env.NODE_ENV === 'production' && !SITE_URL.startsWith('https://')) {
  throw new Error('Production requires an HTTPS SITE_URL and a TLS reverse proxy.');
}
const db = openDb();
const server = makeServer(db, { siteUrl:SITE_URL, trustProxy:TRUST_PROXY === '1', token:TELEGRAM_BOT_TOKEN, chatId:TELEGRAM_CHAT_ID });
server.listen(Number(PORT),HOST,() => console.log('PROX listening on '+HOST+':'+PORT));
for (const signal of ['SIGINT','SIGTERM']) process.once(signal,() => server.close(() => process.exit(0)));
