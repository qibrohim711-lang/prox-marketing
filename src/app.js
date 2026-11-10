import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { adminRow, canAccess, modules, saveModule } from './admin-model.js';
import { adminLayout, dashboard, leadDetail, leads, login, moduleEditor, moduleList } from './admin-view.js';
import { readContent } from './db.js';
import { copy, locales, pagePath, pages } from './i18n.js';
import { renderPublic } from './public.js';
import { checkPassword, digest, getSession, randomToken, rateLimit, readForm, RequestError,
  secureEqual, sessionCookie, validRequestId, verifyChallenge } from './security.js';
import { telegramClient, telegramWorker } from './telegram.js';
import { e } from './ui.js';

const ASSETS = {
  'site.css': 'text/css; charset=utf-8', 'agency.css': 'text/css; charset=utf-8',
  'site.js': 'text/javascript; charset=utf-8', 'signal.svg': 'image/svg+xml', 'growth.svg': 'image/svg+xml'
};
const assetFiles = new Map(Object.entries(ASSETS).map(([name,type]) =>
  ['/assets/'+name, { body: readFileSync(new URL('../public/'+name, import.meta.url)), type }]));
const MEDIA_PATH = /^\/media\/([a-f0-9-]{36})$/;
const ADMIN_PATH = /^\/admin\/([a-z]+)(?:\/(new|[a-z]+|[1-9]\d{0,11}))?$/;
const CONTACT_PATH = /^\/(uz|ru)\/contact$/;
const statuses = new Set(['new','contacted','closed']);

export function makeServer(db, { siteUrl, trustProxy = false, token, chatId, telegramSend, onError = console.error }) {
  const origin = new URL(siteUrl).origin;
  if (!/^https?:\/\//.test(origin)) throw new Error('SITE_URL must be an HTTP(S) URL.');
  const secure = origin.startsWith('https://');
  const telegram = telegramClient({ token, chatId }, telegramSend);
  const drain = telegramWorker(db,telegram);
  const sendPending = () => void drain().catch(() => onError('Telegram queue could not be processed.'));
  const interval = setInterval(() => {
    sendPending();
    try {
      db.prepare('DELETE FROM limits WHERE expires<=?').run(Date.now());
      db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    } catch {
      onError('Expired sessions or rate limits could not be cleaned.');
    }
  },30_000);
  interval.unref();

  const server = createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    if (secure) res.setHeader('Strict-Transport-Security','max-age=31536000');
    res.setHeader('Cache-Control','no-store');

    const send = (body, status = 200, type = 'text/html; charset=utf-8') => {
      res.writeHead(status, { 'Content-Type': type });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    const redirect = (location, status = 303) => {
      res.writeHead(status, { Location: location });
      res.end();
    };
    let pathname = '/';
    let isAdmin = false;
    let user;
    const site = (lang,page,options = {},status = 200) =>
      send(renderPublic({data:readContent(db), lang, page, origin, ...options}),status);
    try {
      const method = req.method;
      const url = new URL(req.url,origin);
      pathname = url.pathname;
      const query = url.searchParams;
      const get = method === 'GET' || method === 'HEAD';
      isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
      if (!get && method !== 'POST') return send('Method not allowed',405,'text/plain');
      if (get && assetFiles.has(pathname)) {
        const { body, type } = assetFiles.get(pathname);
        res.setHeader('Cache-Control','public, max-age=3600');
        return send(body,200,type);
      }
      const mediaPath = pathname.match(MEDIA_PATH);
      if (get && mediaPath) {
        const image = db.prepare('SELECT mime,bytes FROM media WHERE id=?').get(mediaPath[1]);
        if (!image) return send('Not found',404,'text/plain');
        res.setHeader('Cache-Control','public, max-age=3600');
        return send(Buffer.from(image.bytes),200,image.mime);
      }
      if (get && pathname === '/brand.css') {
        const color = query.get('accent') ?? '';
        const font = { system:'system-ui', sans:'Arial,sans-serif', serif:'Georgia,serif' }[query.get('font')];
        const accent = /^#[0-9a-f]{6}$/i.test(color) ? color : '#d8fc63';
        const channels = accent.slice(1).match(/../g).map(hex => {
          const n = parseInt(hex,16)/255;
          return n <= .04045 ? n/12.92 : ((n+.055)/1.055)**2.4;
        });
        const luma = channels[0]*.2126 + channels[1]*.7152 + channels[2]*.0722;
        res.setHeader('Cache-Control','public, max-age=3600');
        return send(`:root{--accent:${accent};--on-accent:${luma > .179 ? '#000' : '#fff'};--font:${typeof font === 'string' ? font : 'system-ui'}}`,200,'text/css; charset=utf-8');
      }
      if (get && pathname === '/robots.txt') return send('User-agent: *\nDisallow: /admin\nSitemap: '+origin+'/sitemap.xml\n',200,'text/plain');
      if (get && pathname === '/sitemap.xml') {
        const available = pages.filter(page => page !== 'portfolio' || readContent(db).settings.brand.content.portfolioNav);
        return send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">' +
          locales.flatMap(lang => available.map(page => '<url><loc>'+e(origin+pagePath(lang,page))+'</loc>' +
            [...locales,'x-default'].map(locale => '<xhtml:link rel="alternate" hreflang="'+locale+'" href="'+e(origin+pagePath(locale === 'x-default' ? 'uz' : locale,page))+'"/>').join('') + '</url>')).join('') +
          '</urlset>',200,'application/xml; charset=utf-8');
      }
      if (get && pathname === '/') return redirect('/uz',308);

      const ip = (trustProxy ? req.headers['x-forwarded-for']?.split(',').at(-1)?.trim() : null) || req.socket.remoteAddress;
      const checkOrigin = () => {
        if (req.headers['sec-fetch-site'] === 'cross-site') return false;
        if (req.headers.origin) return req.headers.origin === origin;
        try { return new URL(req.headers.referer).origin === origin; } catch { return false; }
      };
      if (isAdmin) {
        user = getSession(db,req);
        if (get && pathname === '/admin/login') return user ? redirect('/admin') : send(login());
        if (method === 'POST' && !checkOrigin()) throw new RequestError(403,'Origin verification failed.');
        if (method === 'POST' && pathname === '/admin/login') {
          if (!rateLimit(db,'login-ip:'+ip,15,15*60_000)) return send(login('Too many attempts. Try again later.'),429);
          const form = await readForm(req);
          const email = (form.get('email') ?? '').trim().toLowerCase();
          const password = form.get('password') ?? '';
          if (email.length > 254 || password.length > 128) return send(login('Invalid email or password.'),401);
          if (!rateLimit(db,'login-user:'+email,10,15*60_000)) return send(login('Too many attempts. Try again later.'),429);
          const account = db.prepare('SELECT * FROM users WHERE email=?').get(email);
          if (!await checkPassword(password,account?.password)) return send(login('Invalid email or password.'),401);
          const session = randomToken();
          const ttl = 8*60*60;
          const created = db.prepare('INSERT INTO sessions(token,user_id,expires) SELECT ?,id,? FROM users WHERE id=? AND password=?')
            .run(digest(session),Date.now()+ttl*1000,account.id,account.password);
          if (!created.changes) return send(login('Please sign in again.'),401);
          res.setHeader('Set-Cookie',sessionCookie(session,ttl,secure));
          return redirect('/admin');
        }
        if (!user) return get ? redirect('/admin/login') : send(login('Please sign in.'),401);
        let form;
        if (method === 'POST') {
          if (!rateLimit(db,'admin:'+user.id,120,60_000)) throw new RequestError(429,'Too many changes. Try again shortly.');
          form = await readForm(req,1_950_000);
          if (!secureEqual(user.csrf,form.get('csrf') ?? '')) throw new RequestError(403,'Session verification failed.');
          const currentUser = getSession(db,req);
          if (!currentUser || currentUser.role !== user.role) throw new RequestError(403,'Session expired. Sign in again.');
        }
        if (pathname === '/admin' && get) return send(dashboard(db,user,telegram.configured));
        if (pathname === '/admin/telegram-test' && form) {
          if (user.role !== 'admin') throw new RequestError(403,'Access denied.');
          if (!telegram.configured) return send(dashboard(db,user,false,'Configure Telegram on the server first.'),503);
          if (!rateLimit(db,'telegram-test',1,60_000)) return send(dashboard(db,user,true,'Wait a minute before trying again.'),429);
          const result = await telegram.test();
          return send(dashboard(db,user,true,result.ok ? 'Telegram accepted the test message. Check the owner chat.' :
            'Test delivery failed. Check the server configuration and press Start in the bot chat.',result.ok),result.ok ? 200 : 502);
        }
        if (pathname === '/admin/logout' && form) {
          db.prepare('DELETE FROM sessions WHERE token=?').run(user.token);
          res.setHeader('Set-Cookie',sessionCookie('',0,secure));
          return redirect('/admin/login');
        }
        const match = pathname.match(ADMIN_PATH);
        if (!match) throw new RequestError(404,'Admin page not found.');
        const [,module,id] = match;
        if (module === 'leads') {
          if (user.role !== 'admin') throw new RequestError(403,'Access denied.');
          if (!id && get) return send(leads(db,user,query));
          const row = db.prepare('SELECT * FROM leads WHERE id=?').get(id ?? '');
          if (!row) throw new RequestError(404,'Lead not found.');
          if (get) return send(leadDetail(row,user,query.has('saved')));
          if (form.get('action') === 'retry') {
            db.prepare("UPDATE leads SET telegram='pending',next_attempt=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND telegram IN ('pending','failed')").run(row.id);
            sendPending();
          } else if (form.get('action') === 'status' && statuses.has(form.get('status'))) {
            db.prepare('UPDATE leads SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(form.get('status'),row.id);
          } else throw new RequestError(422,'Invalid lead action.');
          return redirect(pathname+'?saved=1');
        }
        if (!Object.hasOwn(modules,module)) throw new RequestError(404,'Module not found.');
        if (!canAccess(user,module)) throw new RequestError(403,'Access denied.');
        const def = modules[module];
        if (id === 'new' && (def.type || module === 'price' || user.role !== 'admin')) throw new RequestError(403,'Access denied.');
        if (id && def.type === 'setting') throw new RequestError(404,'Admin page not found.');
        if (id && id !== 'new' && !adminRow(db,module,id)) throw new RequestError(404,'Content not found.');
        if (get) return send(id ? moduleEditor(db,module,id,user,{saved:query.has('saved')}) :
          moduleList(db,module,user,query.has('saved')));
        if (!id && def.type !== 'setting') throw new RequestError(404,'Content not found.');
        try {
          saveModule(db,user,module,id === 'new' ? undefined : id,form);
        } catch (error) {
          if (error.status !== 422) throw error;
          return send(moduleEditor(db,module,id,user,{error:error.message}),422);
        }
        return redirect('/admin/'+module+'?saved=1');
      }
      const contact = pathname.match(CONTACT_PATH);
      if (method === 'POST' && contact) {
        const lang = contact[1];
        const t = copy[lang];
        const render = (notice, status, options = {}) => site(lang,'contact',{ notice, ...options },status);
        if (!checkOrigin()) return render(t.error,403);
        if (!rateLimit(db,'lead:'+ip,12,15*60_000)) return render(t.rate,429);
        let form;
        try { form = await readForm(req); } catch (error) {
          if (!error.status) throw error;
          return render(t.valid,error.status);
        }
        const getValue = key => (form.get(key) ?? '').trim();
        const name = getValue('name');
        const phoneInput = getValue('phone');
        const rawPhone = phoneInput.replace(/[ ()-]/g,'');
        const phone = /^\d{9}$/.test(rawPhone) ? '+998'+rawPhone : rawPhone;
        const category = getValue('category');
        const message = getValue('message');
        const requestId = getValue('requestId');
        const selected = db.prepare('SELECT 1 FROM categories WHERE id=?').get(category) ? category : undefined;
        const values = { name:name.slice(0,100),phone:phoneInput.slice(0,24),message:message.slice(0,1500) };
        const options = { selected, values };
        if (name.length < 2 || name.length > 100 || /[\u0000-\u001f]/.test(name) || phoneInput.length > 24 ||
            !/^\+998\d{9}$/.test(phone) || !selected || message.length > 1500) return render(t.valid,422,options);
        const existing = validRequestId(requestId) && db.prepare('SELECT * FROM leads WHERE request_id=?').get(requestId);
        if (existing && existing.phone === phone && existing.name === name && existing.category === category && existing.message === message) {
          return render(t.success,200,{success:true});
        }
        if (existing || getValue('website') || !verifyChallenge(form)) return render(t.captcha,422,options);
        const result = db.prepare('INSERT INTO leads(request_id,name,phone,category,message) VALUES (?,?,?,?,?) ON CONFLICT(request_id) DO NOTHING')
          .run(requestId,name,phone,category,message);
        if (!result.changes) return render(t.captcha,422,options);
        sendPending();
        return render(t.success,200,{success:true});
      }
      if (get && pathname.endsWith('/') && pathname !== '/') {
        const trimmed = pathname.slice(0,-1);
        if (/^\/(uz|ru)(\/[a-z]+)?$/.test(trimmed)) return redirect(trimmed+url.search,308);
      }
      const [,candidate,target,...extra] = pathname.split('/');
      const lang = locales.includes(candidate) ? candidate : 'uz';
      const page = target || 'home';
      if (get && locales.includes(candidate) && !extra.length && pages.includes(page) && target !== 'home') {
        const service = query.get('service');
        const selected = service && db.prepare('SELECT 1 FROM categories WHERE id=?').get(service) ? service : undefined;
        return site(lang,page,{selected});
      }
      return site(lang,'404',{},404);
    } catch (error) {
      if (res.headersSent) return res.end();
      if (!error.status) onError('Unhandled request error: '+error.name);
      if (isAdmin) {
        const status = error.status || 500;
        return send(adminLayout(status === 403 ? 'Access denied' : 'Request failed', '<p>'+e(error.status ? error.message : 'An unexpected error occurred.')+'</p>',user),status);
      }
      const lang = pathname.startsWith('/ru/') || pathname === '/ru' ? 'ru' : 'uz';
      if (req.method === 'POST' && CONTACT_PATH.test(pathname)) {
        try { return site(lang,'contact',{notice:copy[lang].error},500); } catch { /* Database may be unavailable. */ }
      }
      return send(copy[lang].error,error.status || 500,'text/plain; charset=utf-8');
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.on('listening',sendPending);
  server.on('close',() => clearInterval(interval));
  return server;
}
