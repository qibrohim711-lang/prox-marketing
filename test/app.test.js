import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeServer } from '../src/app.js';
import { openDb } from '../src/db.js';
import { locales, pages, pagePath } from '../src/i18n.js';
import { hashPassword } from '../src/security.js';
import { telegramClient, telegramWorker } from '../src/telegram.js';

const webp = 'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
// Transparent 20 × 20 canvas image with the sRGB profile emitted by Chromium.
const canvasWebp = 'UklGRk4CAABXRUJQVlA4WAoAAAAwAAAAEwAAEwAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZBTFBIEgAAAAEPMP8REUIgm3z5mycQ0f9ENlZQOCBGAAAAcAMAnQEqFAAUAD5hLpNHJCKhoSgIAIAMCWcAHAqgNcF6nohAAP70JT/fHU/g2H96/ul96VXiwll6Lx9+/ph7OB/oUgAAAA==';
const password = 'a-test-password-of-sufficient-length';
const csrfFrom = html => html.match(/name="csrf" value="([^"]+)"/)[1];
const consultationForm = html => {
  const challenge = Object.fromEntries([...html.matchAll(/name="(requestId|expires|signature)" value="([^"]+)"/g)]
    .map(([,key,value]) => [key,value]));
  const [,a,b] = html.match(/ · (\d) \+ (\d) = \?/);
  return { ...challenge, answer:Number(a)+Number(b), name:'Test Visitor', phone:'+998 90 123 45 67', category:'it', message:'QA request <script>text</script>' };
};

test('HTTP and database acceptance flow', async t => {
  const dir = mkdtempSync(join(tmpdir(),'prox-qa-'));
  const path = join(dir,'qa.sqlite');
  const db = openDb(path);
  const insertUser = db.prepare('INSERT INTO users(email,password,role) VALUES (?,?,?)');
  insertUser.run('admin@example.test',await hashPassword(password),'admin');
  insertUser.run('editor@example.test',await hashPassword(password),'editor');
  const port = 35241;
  const origin = 'http://127.0.0.1:'+port;
  const server = makeServer(db,{siteUrl:origin,onError:message => assert.fail(message)});
  await new Promise((resolve,reject) => server.once('error',reject).listen(port,'127.0.0.1',resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
    for (const file of [path,path+'-wal',path+'-shm']) rmSync(file,{force:true});
    rmdirSync(dir);
  });

  const get = (route,cookie) => fetch(origin+route,{headers:cookie ? { Cookie:cookie } : {},redirect:'manual'});
  const post = (route,body,cookie,requestOrigin = origin) => fetch(origin+route,{method:'POST',redirect:'manual',
    headers:{ Origin:requestOrigin,...(cookie ? {Cookie:cookie} : {}) },body:new URLSearchParams(body)});
  async function signedIn(email) {
    const response = await post('/admin/login',{email,password});
    assert.equal(response.status,303);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie,/HttpOnly; SameSite=Strict/);
    const session = cookie.split(';')[0];
    return {session,csrf:csrfFrom(await (await get('/admin',session)).text())};
  }

  await t.test('renders every localized page, internal link and image with exact initial content', async () => {
    assert.equal((await get('/')).headers.get('location'),'/uz');
    const targets = new Set();
    for (const lang of locales) {
      for (const page of pages) {
        const route = pagePath(lang,page);
        const response = await get(route);
        assert.equal(response.status,200,route);
        assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
        const html = await response.text();
        assert.match(html,new RegExp('<html lang="'+lang+'">'));
        assert.ok(html.includes('rel="canonical" href="'+origin+route+'"'));
        const alternate = pagePath(lang === 'uz' ? 'ru' : 'uz',page);
        assert.ok(html.includes('href="'+alternate+'"'));
        assert.equal((html.match(/<h1>/g) ?? []).length,1);
        for (const match of html.matchAll(/(?:href|src)="(\/[^"]+)"/g)) targets.add(match[1].replaceAll('&amp;','&').split('#')[0]);
        if (page === 'services') assert.equal((html.match(/class="card service-card"/g) ?? []).length,24);
        if (page === 'pricing') {
          for (const amount of [1500,1350,1200,1000,2000]) {
            const number = new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ').format(amount);
            assert.ok(html.includes('$'+number));
          }
          assert.equal((html.match(/<small>\/ /g) ?? []).length,4);
        }
        if (page === 'contact') {
          for (const value of ['tel:+998200260418','https://t.me/manager_prox','https://www.instagram.com/prox_uz/']) assert.ok(html.includes(value));
        }
      }
    }
    for (const target of targets) assert.equal((await get(target)).status,200,target);
    assert.equal((await get('/sitemap.xml')).status,200);
    assert.match(await (await get('/robots.txt')).text(),/Disallow: \/admin/);
    assert.equal((await get('/ru/unknown')).status,404);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM entries WHERE kind IN (\'project\',\'partner\',\'team\')').get().n,0);
  });

  await t.test('validates leads, protects against spam and persists one lead per request', async () => {
    const html = await (await get('/ru/contact?service=it')).text();
    assert.match(html,/value="it" selected/);
    const form = consultationForm(html);
    assert.equal((await post('/ru/contact',{...form,phone:'123'})).status,422);
    assert.equal((await post('/ru/contact',{...form,answer:0})).status,422);
    assert.equal((await post('/ru/contact',{...form,website:'spam'})).status,422);
    assert.equal((await post('/ru/contact',form,undefined,'https://other.example')).status,403);
    const response = await post('/ru/contact',form);
    assert.equal(response.status,200);
    assert.match(await response.text(),/Ваша заявка принята/);
    assert.equal((await post('/ru/contact',form)).status,200);
    assert.equal((await post('/ru/contact',{...form,message:'changed'})).status,422);
    const persisted = openDb(path);
    assert.deepEqual(persisted.prepare('SELECT name,phone,category,telegram FROM leads').all().map(row => ({...row})),[
      { name:'Test Visitor',phone:'+998901234567',category:'it',telegram:'pending' }
    ]);
    persisted.close();
  });

  await t.test('authenticates admins and editors and enforces server-side roles and CSRF', async () => {
    assert.equal((await get('/admin')).headers.get('location'),'/admin/login');
    assert.equal((await post('/admin/login',{email:'admin@example.test',password:'wrong'})).status,401);
    assert.equal((await post('/admin/login',{email:'admin@example.test',password},undefined,'https://other.example')).status,403);
    const admin = await signedIn('admin@example.test');
    const editor = await signedIn('editor@example.test');
    for (const module of ['home','about','category','service','price','partner','project','banner','contact','team','brand','leads']) {
      assert.equal((await get('/admin/'+module,admin.session)).status,200,module);
    }
    for (const module of ['price','brand','contact','leads']) {
      assert.equal((await get('/admin/'+module,editor.session)).status,403,module);
      assert.equal((await post('/admin/'+module,{csrf:editor.csrf},editor.session)).status,403,module);
    }
    const service = db.prepare("SELECT id FROM entries WHERE kind='service' ORDER BY id").get().id;
    const serviceForm = {csrf:editor.csrf,title_uz:'Tahrirlangan xizmat',title_ru:'Изменённая услуга',description_uz:'Xizmat tavsifi',
      description_ru:'Описание услуги',category:'it',position:99,visible:0};
    assert.equal((await post('/admin/service/'+service,{...serviceForm,csrf:'bad'},editor.session)).status,403);
    assert.equal((await post('/admin/service/new',serviceForm,editor.session)).status,403);
    assert.equal((await post('/admin/service/'+service,{...serviceForm,action:'delete'},editor.session)).status,403);
    assert.equal((await post('/admin/service/'+service,serviceForm,editor.session)).status,303);
    const edited = db.prepare('SELECT category,position,visible FROM entries WHERE id=?').get(service);
    assert.deepEqual({...edited},{category:'smm',position:0,visible:1});
    assert.match(await (await get('/ru/services')).text(),/Изменённая услуга/);

    const entry = { ...serviceForm,csrf:admin.csrf,category:'it',position:77,visible:1,title_uz:'Yangi xizmat',title_ru:'Новая услуга' };
    assert.equal((await post('/admin/service/new',entry,admin.session)).status,303);
    const newId = db.prepare("SELECT max(id) AS id FROM entries WHERE kind='service'").get().id;
    assert.match(await (await get('/uz/services')).text(),/Yangi xizmat/);
    assert.equal((await post('/admin/service/'+newId,{csrf:admin.csrf,action:'delete'},admin.session)).status,303);
    assert.doesNotMatch(await (await get('/uz/services')).text(),/Yangi xizmat/);

    const price = db.prepare("SELECT id FROM entries WHERE kind='price' AND category='smm' ORDER BY id").get().id;
    assert.equal((await post('/admin/price/'+price,{...entry,months:2,amount:1600},admin.session)).status,303);
    const prices = await (await get('/uz/pricing')).text();
    assert.ok(prices.includes('$'+new Intl.NumberFormat('uz-UZ').format(1600)));
    assert.match(prices,/ · 2 oy/);

    assert.equal((await post('/admin/contact',{csrf:admin.csrf,phone:'+998 90 000 00 00',telegram:'test_group',instagram:'test_social'},admin.session)).status,303);
    assert.match(await (await get('/ru/contact')).text(),/tel:\+998900000000/);

    const item = {csrf:admin.csrf,title_uz:'Sinov yozuvi',title_ru:'Тестовая запись',description_uz:'Sinov',description_ru:'Проверка',
      alt_uz:'Tasvir',alt_ru:'Изображение',position:2,upload:webp,visible:1};
    assert.equal((await post('/admin/partner/new',{...item,upload:'PHN2Zz4='},admin.session)).status,422);
    assert.equal((await post('/admin/partner/new',{...item,upload:canvasWebp},admin.session)).status,303);
    const partner = db.prepare("SELECT id,image FROM entries WHERE kind='partner'").get();
    assert.match(await (await get('/uz/partners')).text(),/Sinov yozuvi/);
    assert.match(await (await get('/uz')).text(),/partner-slider/);
    const image = await get('/media/'+partner.image);
    assert.equal(image.headers.get('content-type'),'image/webp');
    const imageBytes = Buffer.from(await image.arrayBuffer());
    assert.ok(!imageBytes.includes(Buffer.from('ICCP')));
    assert.equal(imageBytes[20],0x10);

    assert.equal((await post('/admin/project/new',{...item,visible:0,details_uz:'Tafsilot',details_ru:'Детали'},admin.session)).status,303);
    const project = db.prepare("SELECT id,image FROM entries WHERE kind='project'").get();
    assert.doesNotMatch(await (await get('/ru/portfolio')).text(),/Тестовая запись/);
    assert.equal((await post('/admin/project/'+project.id,{...item,upload:''},admin.session)).status,303);
    assert.match(await (await get('/ru/portfolio')).text(),/Тестовая запись/);
    assert.equal((await post('/admin/project/'+project.id,{csrf:admin.csrf,action:'delete'},admin.session)).status,303);
    assert.equal((await get('/media/'+project.image)).status,404);

    const home = JSON.parse(db.prepare("SELECT content FROM settings WHERE key='home'").get().content);
    const homeForm = Object.fromEntries(Object.entries(home).flatMap(([key,translations]) =>
      Object.entries(translations).map(([lang,value]) => [key+'_'+lang,value])));
    assert.equal((await post('/admin/home',{...homeForm,csrf:editor.csrf,headline_uz:'Yangilangan bosh sahifa',
      imageAlt_uz:'Sinov tasviri',imageAlt_ru:'Тестовое изображение',upload:webp},editor.session)).status,303);
    assert.match(await (await get('/uz')).text(),/Yangilangan bosh sahifa/);
    assert.match(await (await get('/ru')).text(),/alt="Тестовое изображение" fetchpriority/);
    assert.equal((await post('/admin/about',{csrf:editor.csrf,intro_uz:'Agentlik haqida',intro_ru:'Об агентстве',
      mission_uz:'Yangi missiya',mission_ru:'Новая миссия',values_uz:'Qadriyatlar',values_ru:'Ценности'},editor.session)).status,303);
    assert.match(await (await get('/ru/about')).text(),/Новая миссия/);
    assert.equal((await post('/admin/team/new',item,admin.session)).status,303);
    assert.match(await (await get('/uz/about')).text(),/Sinov yozuvi/);
    assert.equal((await post('/admin/banner/new',item,admin.session)).status,303);
    assert.match(await (await get('/uz')).text(),/Sinov yozuvi/);
    assert.equal((await post('/admin/brand',{csrf:admin.csrf,accent:'#ddeeff',font:'serif',upload:webp},admin.session)).status,303);
    const branded = await (await get('/uz')).text();
    assert.doesNotMatch(branded,/href="\/uz\/portfolio"/);
    assert.match(branded,/\/brand\.css\?accent=%23ddeeff&amp;font=serif/);
    assert.match(branded,/<img src="\/media\/[^\"]+" alt="PROX MARKETING AGENCY"/);

    const lead = await (await get('/admin/leads/1',admin.session)).text();
    assert.match(lead,/Test Visitor/);
    assert.doesNotMatch(lead,/<script>text<\/script>/);
    assert.equal((await post('/admin/leads/1',{csrf:admin.csrf,action:'status',status:'contacted'},admin.session)).status,303);
    assert.match(await (await get('/admin/leads?status=contacted&q=Visitor',admin.session)).text(),/Test Visitor/);
    assert.equal((await post('/admin/logout',{csrf:admin.csrf},admin.session)).status,303);
    assert.equal((await get('/admin',admin.session)).status,303);
  });
});

test('Telegram queue preserves leads through an API failure, then retries with a structured message', async () => {
  const db = openDb(':memory:');
  try {
    db.prepare('INSERT INTO leads(request_id,name,phone,category,message,created_at) VALUES (?,?,?,?,?,?)')
      .run('id','Test Name','+998901234567','it','Test <message> _&*','2026-11-09 20:15:06');
    let calls = 0;
    const requests = [];
    const telegram = telegramClient({token:'local-test-token',chatId:'-123'},async (url, options) => {
      assert.match(url,/\/sendMessage$/);
      requests.push(JSON.parse(options.body));
      calls++;
      return {ok:calls > 1,json:async () => ({ok:calls > 1,parameters:{retry_after:60}})};
    });
    const drain = telegramWorker(db,telegram);
    await drain();
    assert.equal(db.prepare('SELECT telegram FROM leads').get().telegram,'failed');
    assert.ok(db.prepare('SELECT next_attempt FROM leads').get().next_attempt > Date.now() + 50_000);
    await drain();
    assert.equal(calls,1);
    db.exec('UPDATE leads SET next_attempt=0');
    await drain();
    assert.deepEqual({...db.prepare('SELECT telegram,attempts FROM leads').get()},{telegram:'sent',attempts:2});
    assert.equal(requests[1].chat_id,'-123');
    assert.equal(requests[1].parse_mode,undefined);
    assert.equal(requests[1].text,[
      '🔔 YANGI BUYURTMA — PROX MARKETING','','👤 Mijoz: Test Name','📞 Telefon: +998901234567',
      '📌 Xizmat: IT','💬 Izoh: Test <message> _&*','📅 Sana: 10/11/2026','🕒 Vaqt: 01:15:06','🆔 Buyurtma ID: 1'
    ].join('\n'));
  } finally {
    db.close();
  }
});

test('Telegram test action is protected and valid leads are persisted before delivery', async t => {
  const db = openDb(':memory:');
  const insert = db.prepare('INSERT INTO users(email,password,role) VALUES (?,?,?)');
  const hash = await hashPassword(password);
  insert.run('admin@example.test',hash,'admin');
  insert.run('editor@example.test',hash,'editor');
  const origin = 'http://127.0.0.1:35242';
  const messages = [];
  let leadCountAtSend;
  const server = makeServer(db,{siteUrl:origin,token:'dummy-secret-for-test',chatId:'6908762743',telegramSend:async (_url,options) => {
    messages.push(JSON.parse(options.body));
    leadCountAtSend = db.prepare('SELECT COUNT(*) AS count FROM leads').get().count;
    return {ok:true,json:async () => ({ok:true})};
  }});
  await new Promise((resolve,reject) => server.once('error',reject).listen(35242,'127.0.0.1',resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
  });
  const post = (path,fields,cookie = '') => fetch(origin+path,{method:'POST',redirect:'manual',
    headers:{Origin:origin,Cookie:cookie},body:new URLSearchParams(fields)});
  const signIn = async role => {
    const response = await post('/admin/login',{email:role+'@example.test',password});
    assert.equal(response.status,303);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const html = await (await fetch(origin+'/admin',{headers:{Cookie:cookie}})).text();
    return {cookie,csrf:csrfFrom(html),html};
  };
  const admin = await signIn('admin');
  const editor = await signIn('editor');
  assert.match(admin.html,/Send Telegram test message/);
  assert.doesNotMatch(admin.html,/dummy-secret-for-test|6908762743/);
  assert.doesNotMatch(editor.html,/Send Telegram test message/);
  const route = '/admin/telegram-test';
  assert.equal((await post(route,{})).status,401);
  assert.equal((await post(route,{csrf:editor.csrf},editor.cookie)).status,403);
  assert.equal((await post(route,{csrf:'invalid'},admin.cookie)).status,403);
  assert.equal(messages.length,0);
  const delivered = await post(route,{csrf:admin.csrf,text:'ignored'},admin.cookie);
  assert.equal(delivered.status,200);
  assert.match(await delivered.text(),/Telegram accepted the test message/);
  assert.equal((await post(route,{csrf:admin.csrf},admin.cookie)).status,429);
  assert.equal(messages.length,1);
  assert.equal(messages[0].chat_id,'6908762743');
  assert.match(messages[0].text,/Telegram sinov xabari/);
  assert.doesNotMatch(messages[0].text,/ignored/);
  assert.equal(leadCountAtSend,0);

  const contact = await (await fetch(origin+'/uz/contact')).text();
  const lead = consultationForm(contact);
  assert.equal((await post('/uz/contact',lead)).status,200);
  assert.equal((await post('/uz/contact',lead)).status,200);
  assert.equal(messages.length,2);
  assert.equal(leadCountAtSend,1);
  assert.match(messages[1].text,/🆔 Buyurtma ID: 1/);
  assert.equal(db.prepare('SELECT telegram FROM leads WHERE id=1').get().telegram,'sent');
});
