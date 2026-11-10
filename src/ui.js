export function e(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

const paths = {
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  diagonal: '<path d="M6 18 18 6M7 6h11v11"/>',
  smm: '<rect x="3" y="4" width="18" height="14" rx="3"/><path d="m8 18-2 3v-3M8 10h8m-8 4h5"/>',
  marketing: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  it: '<rect x="3" y="4" width="18" height="15" rx="3"/><path d="m9 9-3 3 3 3m6-6 3 3-3 3m-3-7-1 8"/>',
  telegram: '<path d="m21 4-4 16-6-5-3 3v-5l10-7-12 6-4-2z"/>',
  phone: '<path d="M5 3h4l2 5-3 2a13 13 0 0 0 6 6l2-3 5 2v4c0 1-1 2-2 2C10 21 3 14 3 5c0-1 1-2 2-2z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>'
};
export const icon = (name) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
export const link = (href, title, className = 'button') => `<a class="${className}" href="${e(href)}">${e(title)} ${icon('diagonal')}</a>`;
export const media = (id, alt = '', options = '') => id ? `<img src="/media/${e(id)}" alt="${e(alt)}" ${options}>` : '';

export function head({ lang, title, description = '', canonical, alternates = {}, image, noIndex = false, stylesheet = '/assets/site.css' }) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${e(title)}</title><meta name="description" content="${e(description)}">
  ${canonical ? `<link rel="canonical" href="${e(canonical)}">
    ${Object.entries(alternates).map(([locale,url]) => `<link rel="alternate" hreflang="${e(locale)}" href="${e(url)}">`).join('')}
    <meta property="og:type" content="website"><meta property="og:title" content="${e(title)}">
    <meta property="og:description" content="${e(description)}"><meta property="og:url" content="${e(canonical)}">
    <meta property="og:locale" content="${lang === 'ru' ? 'ru_RU' : 'uz_UZ'}"><meta property="og:site_name" content="PROX MARKETING AGENCY">` : ''}
  ${image ? `<meta property="og:image" content="${e(image)}">` : ''}
  ${noIndex ? '<meta name="robots" content="noindex,nofollow">' : ''}
  <meta name="theme-color" content="#090b14"><link rel="stylesheet" href="${stylesheet}?v=2"><script src="/assets/site.js?v=2" defer></script></head>`;
}
