import { adminRow, canAccess, fieldsFor, modules } from './admin-model.js';
import { e, head, media } from './ui.js';

const field = (label, name, value, attrs = 'required') => `<label>${e(label)}<input name="${name}" value="${e(value)}" ${attrs}></label>`;
const checkbox = (label, name, value) => `<label class="check"><input type="checkbox" name="${name}" value="1"${value ? ' checked' : ''}> ${label}</label>`;
const csrf = (user) => `<input type="hidden" name="csrf" value="${e(user.csrf)}">`;
const button = (text, extra = '') => `<button class="button dark" type="submit" ${extra}>${text}</button>`;
const statuses = ['new','contacted','closed'];
const deliveryLabels = { pending: 'Pending', sending: 'Sending', sent: 'Sent', failed: 'Failed' };
const deliveryBadge = (state) => `<span class="delivery-badge delivery-${state}">${deliveryLabels[state]}</span>`;

export function adminLayout(title, body, user) {
  const nav = user ? `<aside class="admin-sidebar"><a class="wordmark" href="/admin">PROX<span>.</span></a><p>Content studio</p><nav aria-label="Admin modules">
    <a href="/admin">Overview</a>${Object.entries(modules).filter(([key]) => canAccess(user,key)).map(([key, def]) =>
      `<a href="/admin/${key}">${def.label}</a>`).join('')}
    ${user.role === 'admin' ? '<a href="/admin/leads">Leads</a>' : ''}<a href="/uz">View website ↗</a></nav>
    <form action="/admin/logout" method="post">${csrf(user)}${button('Sign out')}</form></aside>` : '';
  return head({lang:'en',title:title + ' | PROX CMS',noIndex:true}) +
    `<body class="admin-body">${nav}<main class="${user ? 'admin-main' : 'login'}"><p class="eyebrow">PROX / CMS</p><h1>${e(title)}</h1>${body}</main></body></html>`;
}

export function login(error = '') {
  return adminLayout('Sign in', `<form class="card lead-form" method="post" action="/admin/login">
    ${error ? `<p class="notice error" role="alert">${e(error)}</p>` : ''}
    ${field('Email','email','','type="email" required maxlength="254" autocomplete="username"')}
    ${field('Password','password','','type="password" required maxlength="128" autocomplete="current-password"')}
    ${button('Sign in')}<a href="/uz">Back to website</a></form>`);
}

export function dashboard(db, user, telegramConfigured, feedback, delivered = false) {
  if (user.role !== 'admin') return adminLayout('Overview', '<p>Use the menu to edit permitted text and images.</p>',user);
  const counts = db.prepare('SELECT status,count(*) AS count FROM leads GROUP BY status').all();
  const count = status => counts.find(row => row.status === status)?.count ?? 0;
  const recent = db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 5').all();
  return adminLayout('Overview', `<div class="grid four">${[['Total leads', counts.reduce((sum,row) => sum+row.count,0)], ...statuses.map(status => [status,count(status)])].map(([label,n]) =>
    `<article class="card metric"><span>${label}</span><strong>${n}</strong></article>`).join('')}</div>
    <h2>Telegram notifications</h2><section class="card">
      <p>${telegramConfigured ? 'Bot configured. Send a test message to check delivery.' : 'Set the bot token and chat ID in the server environment to enable delivery.'}</p>
      ${feedback ? `<p class="notice ${delivered ? 'success' : 'error'}" role="${delivered ? 'status' : 'alert'}">${e(feedback)}</p>` : ''}
      ${telegramConfigured ? `<form method="post" action="/admin/telegram-test">${csrf(user)}${button('Send Telegram test message')}</form>` : ''}
    </section><h2>Recent requests</h2>${recent.length ? leadTable(recent) : '<p class="empty">No leads yet.</p>'}`,user);
}

function leadTable(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Category</th><th>Status</th><th>Telegram</th><th>Received (UTC)</th></tr></thead>
    <tbody>${rows.map(row => `<tr><td><a href="/admin/leads/${row.id}">${e(row.name)}</a></td><td>${e(row.phone)}</td>
    <td>${e(row.category)}</td><td>${row.status}</td><td>${deliveryBadge(row.telegram)}</td><td>${row.created_at}</td></tr>`).join('')}</tbody></table></div>`;
}

export function leads(db, user, query) {
  const q = (query.get('q') ?? '').slice(0,100);
  const status = statuses.includes(query.get('status')) ? query.get('status') : '';
  const page = Math.max(1,Math.min(100000,parseInt(query.get('page'),10) || 1));
  const rows = db.prepare(`SELECT * FROM leads WHERE (?='' OR status=?) AND
    (instr(lower(name), lower(?))>0 OR instr(phone,?)>0) ORDER BY id DESC LIMIT 51 OFFSET ?`)
    .all(status,status,q,q,(page-1)*50);
  const pageLink = n => '/admin/leads?' + new URLSearchParams({ q,status,page:n });
  return adminLayout('Leads', `<form class="filters" method="get">${field('Search name or phone','q',q,'maxlength="100"')}
    <label>Status<select name="status"><option value="">All</option>${statuses.map(s => `<option${s === status ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
    ${button('Filter')}</form>${rows.length ? leadTable(rows.slice(0,50)) : '<p class="empty">No matching leads.</p>'}
    <p class="pagination">${page > 1 ? `<a href="${e(pageLink(page-1))}">Previous</a>` : ''} ${rows.length > 50 ? `<a href="${e(pageLink(page+1))}">Next</a>` : ''}</p>`,user);
}

export function leadDetail(row, user, saved) {
  return adminLayout('Lead #' + row.id, `<p><a href="/admin/leads">← All leads</a></p>
    ${saved ? '<p class="notice success" role="status">Lead updated.</p>' : ''}
    <article class="card"><h2>${e(row.name)}</h2><dl><dt>Phone</dt><dd><a href="tel:${e(row.phone)}">${e(row.phone)}</a></dd>
    <dt>Service category</dt><dd>${e(row.category)}</dd><dt>Received (UTC)</dt><dd>${row.created_at}</dd>
    <dt>Message</dt><dd class="preserve">${e(row.message || '—')}</dd><dt>Telegram</dt><dd>${deliveryBadge(row.telegram)} · ${row.attempts} attempt(s)</dd></dl></article>
    <form class="filters" method="post">${csrf(user)}<label>Status<select name="status">${statuses.map(s =>
      `<option${s === row.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
    ${button('Update status','name="action" value="status"')}
    ${row.telegram !== 'sent' && row.telegram !== 'sending' ? button('Retry Telegram','name="action" value="retry"') : ''}</form>`,user);
}

export function moduleList(db, module, user, saved) {
  const def = modules[module];
  if (def.type === 'setting') return moduleEditor(db,module,undefined,user,{ saved });
  const rows = def.type === 'category' ? db.prepare('SELECT * FROM categories ORDER BY position').all()
    : db.prepare('SELECT * FROM entries WHERE kind=? ORDER BY category,position,id').all(module);
  return adminLayout(def.label,`${saved ? '<p class="notice success" role="status">Changes saved.</p>' : ''}
    ${!def.type && module !== 'price' && user.role === 'admin' ? `<a class="button dark" href="/admin/${module}/new">Add entry</a>` : ''}
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Uzbek title</th><th>Russian title</th><th>Category</th><th>Order</th><th>Visibility</th></tr></thead>
    <tbody>${rows.map(row => {
      const item = JSON.parse(row.content);
      return `<tr><td><a href="/admin/${module}/${row.id}">${e(item.title.uz)}${module === 'price' && item.months ? ' · '+item.months+' months' : ''}</a></td>
      <td>${e(item.title.ru)}</td><td>${e(row.category ?? '—')}</td><td>${row.position}</td><td>${row.visible === undefined ? '—' : row.visible ? 'Public' : 'Hidden'}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="empty">No entries yet.</p>'}`,user);
}

export function moduleEditor(db, module, id, user, { saved, error } = {}) {
  const def = modules[module];
  const row = adminRow(db,module,id ?? '');
  const data = row?.content ?? {};
  const imageId = row?.[def.logo ? 'logo' : 'image'];
  const localizedFields = Object.entries(fieldsFor(module));
  const categories = def.category ? db.prepare('SELECT id,content FROM categories ORDER BY position').all() : [];
  const isAdmin = user.role === 'admin';
  const title = def.type === 'setting' ? def.label : (row ? 'Edit ' : 'Add ') + def.label.toLowerCase() + ' entry';
  return adminLayout(title, `${!def.type || def.type === 'category' ? `<p><a href="/admin/${module}">← ${def.label}</a></p>` : ''}
    ${saved ? '<p class="notice success" role="status">Changes saved.</p>' : ''}
    ${error ? `<p class="notice error" role="alert">${e(error)}</p>` : ''}
    <form class="lead-form admin-form card" method="post" data-image-form>
      ${csrf(user)}
      ${localizedFields.length ? `<div class="grid two">${['uz','ru'].map(lang => `<fieldset><legend>${lang === 'uz' ? 'Uzbek' : 'Russian'}</legend>
      ${localizedFields.map(([key,label]) => `<label>${label}<textarea name="${key}_${lang}" rows="${key === 'details' || key === 'description' ? 4 : 2}" maxlength="${key === 'details' ? 3000 : 1500}">${e(data[key]?.[lang])}</textarea></label>`).join('')}</fieldset>`).join('')}</div>` : ''}
      ${isAdmin && def.category && module !== 'price' ? `<label>Category<select name="category">${categories.map(cat =>
        `<option value="${cat.id}"${row?.category === cat.id ? ' selected' : ''}>${e(JSON.parse(cat.content).title.uz)}</option>`).join('')}</select></label>` : ''}
      ${module === 'price' && row?.category !== 'it' ? field(row?.category === 'smm' ? 'Monthly price (USD)' : 'Starting price (USD)','amount',data.amount,'type="number" min="1" max="1000000" required') : ''}
      ${module === 'price' && row?.category === 'smm' ? field('Package duration (months)','months',data.months,'type="number" min="1" max="120" required') : ''}
      ${isAdmin && !def.type ? field('Display order (lowest first)','position',row?.position ?? 0,'type="number" min="0" max="9999" required') : ''}
      ${isAdmin && !def.type && module !== 'price' ? checkbox('Visible on website','visible',row?.visible ?? false) : ''}
      ${module === 'contact' ? field('Phone','phone',data.phone,'required maxlength="24"') + field('Telegram handle','telegram',data.telegram) +
        field('Instagram handle','instagram',data.instagram) + field('Google Maps URL (optional)','maps',data.maps,'type="url" maxlength="512"') : ''}
      ${module === 'brand' ? field('Accent color','accent',data.accent,'type="color" required') + `<label>Typography<select name="font">${['system','sans','serif'].map(font =>
        `<option${data.font === font ? ' selected' : ''}>${font}</option>`).join('')}</select></label>` + checkbox('Show portfolio in public navigation','portfolioNav',data.portfolioNav) : ''}
      ${def.image || def.logo ? `<label>${def.logo ? 'Logo' : 'Image'}<input type="file" data-image accept="image/png,image/jpeg,image/webp"></label>
        <small>PNG, JPEG or WebP · up to 12 MB. Your browser resizes and optimizes images.</small>
        <input type="hidden" name="upload">${media(imageId,'Current image','class="preview"')}
        ${imageId && !def.imageRequired ? checkbox('Remove current image','removeImage',false) : ''}<p data-image-error class="notice error" hidden role="alert"></p>` : ''}
      <div class="admin-actions">${button('Save changes')}${row && isAdmin && !def.type && module !== 'price' ?
        '<button class="button danger" type="submit" name="action" value="delete" formnovalidate data-confirm="Delete this entry?">Delete</button>' : ''}</div>
    </form>`,user);
}
