import { randomUUID } from 'node:crypto';
import { purgeOrphanMedia, transaction } from './db.js';
import { locales } from './i18n.js';
import { RequestError } from './security.js';

export const modules = {
  home: { label: 'Homepage', type: 'setting', editor: true, image: true, fields: { headline: 'Hero headline', description: 'Hero description', cta: 'Consultation button', imageAlt: 'Hero image alt text (optional)', strength1Title: 'Strength 1 title', strength1Text: 'Strength 1 description', strength2Title: 'Strength 2 title', strength2Text: 'Strength 2 description', strength3Title: 'Strength 3 title', strength3Text: 'Strength 3 description' } },
  about: { label: 'About', type: 'setting', editor: true, fields: { intro: 'Introduction', mission: 'Mission', values: 'Values' } },
  category: { label: 'Service categories', type: 'category', editor: true, fields: { title: 'Title', description: 'Description' } },
  service: { label: 'Services', category: true, image: true, editor: true },
  price: { label: 'Pricing', category: true },
  partner: { label: 'Partners', image: true, imageRequired: true, editor: true },
  project: { label: 'Portfolio', image: true, imageRequired: true, editor: true, fields: { title: 'Title', description: 'Description', details: 'Project details (optional)', alt: 'Image alt text' } },
  banner: { label: 'Banners', image: true, editor: true },
  contact: { label: 'Contact settings', type: 'setting', fields: { address: 'Office address (optional)' } },
  team: { label: 'Team', image: true, editor: true },
  brand: { label: 'Site branding', type: 'setting', logo: true, fields: {} }
};

export const fieldsFor = (module) => modules[module].fields ?? {
  title: 'Title',
  description: module === 'price' ? 'Description and conditions' : 'Description',
  ...(modules[module].image ? { alt: 'Image alt text' } : {})
};
export const canAccess = (user, module) => Object.hasOwn(modules, module) && (user.role === 'admin' || modules[module].editor);
const fail = (message, status = 422) => { throw new RequestError(status, message); };
const value = (form, key) => (form.get(key) ?? '').trim();
const required = (form, key, label, max, optional = false) => {
  const result = value(form,key);
  if ((!optional && !result) || result.length > max) fail(label + ' must contain ' + (optional ? 'at most ' : '1–') + max + ' characters.');
  return result;
};
const integer = (form,key,min,max) => {
  const raw = value(form,key);
  const result = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(result) || result < min || result > max) fail(key + ' must be an integer from ' + min + ' to ' + max + '.');
  return result;
};

function sanitizeWebP(data) {
  if (data.length < 26 || data.toString('ascii',0,4) !== 'RIFF' || data.readUInt32LE(4) !== data.length-8 ||
      data.toString('ascii',8,12) !== 'WEBP') return false;
  let offset = 12;
  let image = false;
  let extended = false;
  let alpha = false;
  let profile;
  while (offset + 8 <= data.length) {
    const type = data.toString('ascii',offset,offset+4);
    const size = data.readUInt32LE(offset+4);
    const start = offset + 8;
    offset = start + size + (size % 2);
    if (offset > data.length || !size || image) return false;
    if (type === 'VP8X') {
      if (start !== 20 || size !== 10 || (data[start] & ~0x30) || data.readUIntLE(start+1,3) !== 0 ||
        data.readUIntLE(start+4,3) >= 1800 || data.readUIntLE(start+7,3) >= 1800) return false;
      extended = true;
    } else if (type === 'ICCP') {
      if (!extended || start !== 38 || !(data[20] & 0x20) || size > 65_536) return false;
      profile = { start: start-8, end: offset };
    } else if (type === 'ALPH') {
      if (!extended || alpha || !(data[20] & 0x10)) return false;
      alpha = true;
    } else if (type === 'VP8 ' || type === 'VP8L') {
      let width, height;
      if (type === 'VP8 ') {
        if (size <= 10 || data[start] & 1 || data.readUIntLE(start+3,3) !== 0x2a019d) return false;
        width = data.readUInt16LE(start+6) & 0x3fff;
        height = data.readUInt16LE(start+8) & 0x3fff;
      } else {
        if (size <= 5 || data[start] !== 0x2f || alpha) return false;
        const bits = data.readUInt32LE(start+1);
        if (bits >>> 29) return false;
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
      }
      if (!width || !height || width > 1800 || height > 1800 ||
        (extended && (width !== data.readUIntLE(24,3)+1 || height !== data.readUIntLE(27,3)+1))) return false;
      image = true;
    } else return false;
  }
  if (!image || offset !== data.length || (extended && Boolean(data[20] & 0x20) !== Boolean(profile))) return false;
  if (!profile) return data;

  // Chromium adds an sRGB profile to canvas output. Store the image without metadata.
  const cleaned = Buffer.concat([data.subarray(0,profile.start),data.subarray(profile.end)]);
  cleaned[20] &= ~0x20;
  cleaned.writeUInt32LE(cleaned.length-8,4);
  return cleaned;
}

function upload(db, form, prior, allowRemoval) {
  const base64 = value(form,'upload');
  if (!base64) return allowRemoval && form.get('removeImage') === '1' ? null : prior;
  if (base64.length > 600_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) fail('Invalid image.');
  const data = sanitizeWebP(Buffer.from(base64, 'base64'));
  if (!data) fail('Upload a valid, optimized WebP image.');
  const id = randomUUID();
  db.prepare("INSERT INTO media(id,mime,bytes) VALUES (?,'image/webp',?)").run(id,data);
  return id;
}

export function adminRow(db, module, id) {
  const type = modules[module].type;
  const row = type === 'setting' ? db.prepare('SELECT * FROM settings WHERE key=?').get(module)
    : type === 'category' ? db.prepare('SELECT * FROM categories WHERE id=?').get(id)
      : db.prepare('SELECT * FROM entries WHERE kind=? AND id=?').get(module,id);
  return row && { ...row, content: JSON.parse(row.content) };
}

export function saveModule(db, user, module, id, form) {
  if (!canAccess(user,module)) fail('Access denied.',403);
  const def = modules[module];
  const admin = user.role === 'admin';
  const creating = !def.type && !id;
  return transaction(db, () => {
    const row = adminRow(db,module,id ?? '');
    if (!creating && !row) fail('Content not found.',404);
    if ((creating || form.get('action') === 'delete') && !admin) fail('Access denied.',403);
    if (form.get('action') === 'delete') {
      if (def.type || module === 'price' || !row) fail('This entry cannot be deleted.');
      db.prepare('DELETE FROM entries WHERE id=? AND kind=?').run(id,module);
      purgeOrphanMedia(db);
      return;
    }

    const currentImage = row?.[def.logo ? 'logo' : 'image'] ?? null;
    const image = def.image || def.logo ? upload(db,form,currentImage,true) : null;
    const content = { ...row?.content };
    for (const [key,label] of Object.entries(fieldsFor(module))) {
      const optional = label.includes('(optional)') || (key === 'alt' && !image);
      content[key] = Object.fromEntries(locales.map(lang => [lang, required(form,key+'_'+lang,label+' ('+lang.toUpperCase()+')',
        key === 'details' ? 3000 : key === 'title' || key.endsWith('Title') || key === 'alt' || key === 'headline' || key === 'imageAlt' || key === 'cta' ? 160 : 1500, optional)]));
    }
    if (def.imageRequired && !image) fail('This entry requires an image.');
    if (module === 'contact') {
      content.phone = required(form,'phone','Phone',24);
      if (!/^\+998\d{9}$/.test(content.phone.replace(/[ ()-]/g,''))) fail('Enter a valid +998 phone number.');
      for (const field of ['telegram','instagram']) {
        content[field] = value(form,field).replace(/^@/,'');
        if (!/^[a-zA-Z0-9_.]{1,32}$/.test(content[field]) || /^\.+$/.test(content[field])) fail('Invalid ' + field + ' account handle.');
      }
      content.maps = required(form,'maps','Google Maps URL',512,true);
      if (content.maps) {
        let url;
        try { url = new URL(content.maps); } catch { fail('Enter a valid Google Maps URL.'); }
        if (url.protocol !== 'https:' || url.username || url.password || !['maps.google.com','www.google.com','maps.app.goo.gl'].includes(url.hostname)) fail('Enter a Google Maps HTTPS URL.');
      }
    }
    if (module === 'brand') {
      content.accent = value(form,'accent');
      content.font = value(form,'font');
      content.portfolioNav = form.get('portfolioNav') === '1';
      if (!/^#[0-9a-f]{6}$/i.test(content.accent) || !['system','sans','serif'].includes(content.font)) fail('Invalid brand colors or font.');
    }

    if (def.type === 'setting') {
      db.prepare('UPDATE settings SET content=?, image=?, logo=?, updated_at=CURRENT_TIMESTAMP WHERE key=?')
        .run(JSON.stringify(content),def.image ? image : null,def.logo ? image : null,module);
    } else if (def.type === 'category') {
      db.prepare('UPDATE categories SET content=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(content),id);
    } else {
      const category = module === 'price' ? row?.category : def.category ? (admin ? value(form,'category') : row.category) : null;
      if (def.category && !db.prepare('SELECT 1 FROM categories WHERE id=?').get(category ?? '')) fail('Select a valid service category.');
      if (module === 'price') {
        if (category !== 'it') content.amount = integer(form,'amount',1,1_000_000);
        if (category === 'smm') content.months = integer(form,'months',1,120);
      }
      const position = admin ? integer(form,'position',0,9999) : row.position;
      const visible = module === 'price' ? 1 : admin ? Number(form.get('visible') === '1') : row.visible;
      if (creating) {
        db.prepare('INSERT INTO entries(kind,category,position,visible,image,content) VALUES (?,?,?,?,?,?)').run(module,category,position,visible,image,JSON.stringify(content));
      } else {
        db.prepare('UPDATE entries SET category=?,position=?,visible=?,image=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE kind=? AND id=?')
          .run(category,position,visible,image,JSON.stringify(content),module,id);
      }
    }
    purgeOrphanMedia(db);
  });
}
