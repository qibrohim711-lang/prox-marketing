import { copy, locales, localized, pagePath, pages } from './i18n.js';
import { challenge } from './security.js';
import { e, head, icon, link, media } from './ui.js';

export function renderPublic({ data, lang, page, origin, selected, notice, values = {}, success = false }) {
  const t = copy[lang];
  const p = (target) => pagePath(lang, target);
  const tr = (row, key) => e(localized(row.content, key, lang));
  const select = (kind, category) => data.entries.filter(row => row.visible && row.kind === kind && (!category || row.category === category));
  const { home, about, brand } = data.settings;
  const contact = data.settings.contact.content;
  const cta = localized(home.content, 'cta', lang);
  const formPath = p('contact') + '#request';
  const request = (category) => p('contact') + '?service=' + category + '#request';
  const nav = pages.filter(item => item !== 'portfolio' || brand.content.portfolioNav);
  const phone = 'tel:' + contact.phone.replace(/[^+\d]/g, '');
  const tg = 'https://t.me/' + contact.telegram;
  const ig = 'https://www.instagram.com/' + contact.instagram + '/';
  const name = 'PROX MARKETING AGENCY';
  const logo = brand.logo ? media(brand.logo, name, 'width="124" height="42"') : '<span class="wordmark">PROX<span>.</span></span>';
  const navLinks = nav.map(item => `<a href="${p(item)}"${page === item ? ' aria-current="page"' : ''}>${e(t[item])}</a>`).join('');
  const languages = `<div class="languages" aria-label="${e(t.language)}">${locales.map(locale =>
    `<a lang="${locale}" hreflang="${locale}" href="${pagePath(locale, page === '404' ? 'home' : page)}${page === 'contact' && selected ? '?service=' + selected : ''}"${locale === lang ? ' aria-current="true"' : ''}>${locale.toUpperCase()}</a>`).join('')}</div>`;
  const header = `<a class="skip" href="#main">${t.skip}</a><header class="site-header"><div class="shell top">
    <a class="brand" href="${p('home')}" aria-label="${name}">${logo}</a>
    <nav class="desktop-nav" aria-label="${t.navigate}">${navLinks}</nav>
    <div class="header-actions">${languages}${link(formPath, cta, 'button small header-cta')}
    <details class="mobile-nav"><summary aria-label="${t.menu}">${icon('menu')}</summary><nav aria-label="${t.navigate}">${navLinks}${link(formPath, cta)}</nav></details></div>
    </div></header>`;
  const footer = `<footer class="footer"><div class="shell footer-grid">
    <div><a class="brand" href="${p('home')}" aria-label="${name}">${logo}</a><p>${t.footerSummary}</p></div>
    <div><h2>${t.navigate}</h2><nav aria-label="${t.navigate}">${navLinks}</nav></div>
    <div><h2>${t.connect}</h2><a href="${phone}">${e(contact.phone)}</a><a href="${ig}">Instagram · @${e(contact.instagram)}</a><a href="${tg}">Telegram · @${e(contact.telegram)}</a></div>
    <div>${languages}</div>
    </div><div class="shell footer-end">© ${new Date().getFullYear()} ${name}</div></footer>
    <a class="floating" href="${tg}" aria-label="Telegram · @${e(contact.telegram)}" title="Telegram">${icon('telegram')}</a>`;
  const section = (label, title, html, cls = '') => `<section class="section ${cls}"><div class="shell"><p class="eyebrow">${e(label)}</p><h2>${e(title)}</h2>${html}</div></section>`;
  const pageHero = (title, intro) => `<section class="page-hero"><div class="shell page-hero-inner"><div><p class="eyebrow signal">${t.agency}</p><h1>${e(title)}</h1><p class="page-intro">${e(intro)}</p></div><span class="page-ordinal" aria-hidden="true">0${Math.max(1,pages.indexOf(page)+1)}</span></div></section>`;
  const ctaStrip = () => `<section class="section"><div class="shell"><div class="cta-strip"><div><h2>${t.question}</h2><p>${t.ctaText}</p></div>${link(formPath, cta, 'button dark')}</div></div></section>`;
  const categoryTitle = (id) => localized(data.categories.find(row => row.id === id).content, 'title', lang);
  const priceAmount = (row) => '$' + new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'uz-UZ').format(row.content.amount);
  const priceLabel = (row) => row.category === 'smm'
    ? `${priceAmount(row)} <small>/ ${t.month}</small>`
    : row.category === 'marketing'
      ? (lang === 'uz' ? `${priceAmount(row)} <small>${t.from}</small>` : `<small>${t.from}</small> ${priceAmount(row)}`)
      : e(t.individual);
  const prices = (rows) => rows.map((row,i) => `<article class="card price-card"><div class="card-head"><p class="eyebrow">${e(categoryTitle(row.category))}</p><span class="card-index" aria-hidden="true">0${i+1}</span></div>
    <h3>${tr(row,'title')}${row.category === 'smm' ? ' · ' + row.content.months + ' ' + t.months : ''}</h3>
    <p class="price">${priceLabel(row)}</p><p>${tr(row,'description')}</p>
    ${link(request(row.category), row.category === 'it' ? t.estimate : t.apply, 'text-link')}</article>`).join('');
  const partnerCards = select('partner').map(row => `<article class="partner-card">
    ${media(row.image, localized(row.content,'alt',lang), 'loading="lazy" decoding="async"')}
    <h3>${tr(row,'title')}</h3></article>`).join('');
  const introductions = {
    home: localized(home.content, 'description', lang), about: t.aboutIntro, services: t.serviceIntro,
    pricing: t.priceIntro, partners: t.partnerIntro, portfolio: t.portfolioIntro, contact: t.contactIntro
  };

  function form() {
    const q = challenge();
    return `<form class="lead-form" method="post" action="${p('contact')}#request" novalidate data-lock data-sending="${e(t.sending)}" data-invalid="${e(t.valid)}" data-captcha="${e(t.captcha)}">
      ${notice ? `<p class="notice ${success ? 'success' : 'error'}" role="${success ? 'status' : 'alert'}">${e(notice)}</p>` : ''}
      <p class="notice error" id="form-feedback" role="alert" hidden></p>
      <input type="hidden" name="requestId" value="${q.id}"><input type="hidden" name="expires" value="${q.expires}">
      <input type="hidden" name="signature" value="${q.signature}"><div hidden><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="form-grid"><label>${t.name}<input name="name" autocomplete="name" required maxlength="100" value="${e(values.name)}"></label>
      <label>${t.phone}<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="24" placeholder="+998 90 123 45 67" value="${e(values.phone)}"></label></div>
      <label>${t.category}<select name="category" required><option value="">${t.select}</option>${data.categories.map(row =>
        `<option value="${row.id}"${selected === row.id ? ' selected' : ''}>${tr(row,'title')}</option>`).join('')}</select></label>
      <label>${t.message}<textarea name="message" rows="3" maxlength="1500">${e(values.message)}</textarea></label>
      <label>${t.answer} · ${q.a} + ${q.b} = ?<input class="answer" name="answer" inputmode="numeric" required pattern="[0-9]{1,2}" maxlength="2" autocomplete="off"></label>
      <button type="submit" class="button dark">${t.send} ${icon('arrow')}</button>
    </form>`;
  }

  function body() {
    switch (page) {
      case 'home': {
        const banners = select('banner');
        return `<section class="hero"><div class="shell hero-grid"><div class="hero-copy">
          <p class="eyebrow signal">${t.agency}</p><h1>${tr(home,'headline')}</h1><p class="hero-description">${tr(home,'description')}</p>
          <div class="hero-actions">${link(formPath, cta)}${link(p('services'), t.explore, 'button outline')}</div></div>
          <figure class="hero-figure${home.image ? ' has-upload' : ''}"><div class="art-label" aria-hidden="true"><span>PROX / ${t.studio}</span><span>01 — 03</span></div>
          ${home.image ? media(home.image, localized(home.content,'imageAlt',lang), 'fetchpriority="high"') :
            '<img src="/assets/signal.svg" alt="" width="760" height="680" fetchpriority="high">'}
          <figcaption><span>${t.diagram}</span><span>${t.diagramCaption}</span></figcaption></figure>
          </div><div class="shell hero-index">${data.categories.map((row, i) => `<a href="${p('services')}#${row.id}"><span>0${i+1}</span>${tr(row,'title')} ${icon('diagonal')}</a>`).join('')}</div></section>
          ${section(t.direction, t.what, `<div class="grid three">${data.categories.map((row, i) =>
            `<article class="card service-card"><div class="card-head"><span class="icon-box">${icon(row.id)}</span><span>0${i+1}</span></div>
            <h3>${tr(row,'title')}</h3><p>${tr(row,'description')}</p>${link(p('services') + '#' + row.id,t.more,'text-link')}</article>`).join('')}</div>`)}
          ${banners.length ? `<section class="section soft"><div class="shell grid three">${banners.map(row =>
            `<article class="card">${media(row.image, localized(row.content,'alt',lang),'loading="lazy" class="project-image"')}<h2>${tr(row,'title')}</h2><p>${tr(row,'description')}</p></article>`).join('')}</div></section>` : ''}
          ${section(t.approach, t.strengths, `<div class="grid three strengths">${[1,2,3].map(i =>
            `<article><span class="step">0${i}</span><h3>${tr(home,'strength'+i+'Title')}</h3><p>${tr(home,'strength'+i+'Text')}</p></article>`).join('')}</div>`, 'soft')}
          ${partnerCards ? section(t.partners, t.partnerIntro, `<div class="slider-controls"><button type="button" data-slide="-1" aria-label="${t.prev}">←</button><button type="button" data-slide="1" aria-label="${t.next}">→</button></div><div class="partner-slider" data-slider tabindex="0" aria-label="${t.partners}">${partnerCards}</div>`) : ''}
          ${section(t.budget,t.pricing,`<div class="grid two">${prices([select('price','smm')[0],select('price','marketing')[0]].filter(Boolean))}</div><div class="section-action">${link(p('pricing'),t.prices,'button dark')}</div>`)}
          ${ctaStrip()}`;
      }
      case 'about':
        return pageHero(t.about, localized(about.content,'intro',lang)) + `<section class="section about-section"><div class="shell grid two">
          <article class="card"><p class="eyebrow">01</p><h2>${t.mission}</h2><p>${tr(about,'mission')}</p></article>
          <article class="card"><p class="eyebrow">02</p><h2>${t.values}</h2><p>${tr(about,'values')}</p></article></div></section>` +
          (select('team').length ? section(t.about,t.team,`<div class="grid three">${select('team').map(row =>
            `<article class="card">${media(row.image,localized(row.content,'alt',lang),'loading="lazy" class="project-image"')}<h3>${tr(row,'title')}</h3><p>${tr(row,'description')}</p></article>`).join('')}</div>`) : '') + ctaStrip();
      case 'services':
        return pageHero(t.services,t.serviceIntro) + `<div class="shell category-links">${data.categories.map(row => link('#'+row.id,localized(row.content,'title',lang),'button outline')).join('')}</div>` +
          data.categories.map((cat, i) => `<section class="section ${i % 2 ? 'soft' : ''}" id="${cat.id}"><div class="shell"><p class="eyebrow">${t.direction} / 0${i+1}</p>
            <h2>${tr(cat,'title')}</h2><p class="section-description">${tr(cat,'description')}</p>
            <div class="grid three">${select('service',cat.id).map(row => `<article class="card service-card"><div class="card-head">${row.image ?
              media(row.image,localized(row.content,'alt',lang),'class="icon-box" loading="lazy"') : '<span class="icon-box">'+icon(cat.id)+'</span>'}</div>
              <h3>${tr(row,'title')}</h3><p>${tr(row,'description')}</p>${link(request(cat.id),t.apply,'text-link')}</article>`).join('')}</div></div></section>`).join('') + ctaStrip();
      case 'pricing':
        return pageHero(t.pricing,t.priceIntro) + section(t.budget, categoryTitle('smm'), `<div class="grid four">${prices(select('price','smm'))}</div>`) +
          `<section class="section soft"><div class="shell grid two">${prices([...select('price','marketing'),...select('price','it')])}</div></section>`;
      case 'partners':
        return pageHero(t.partners,t.partnerIntro) + `<section class="section"><div class="shell">${partnerCards ?
          `<div class="slider-controls"><button type="button" data-slide="-1" aria-label="${t.prev}">←</button><button type="button" data-slide="1" aria-label="${t.next}">→</button></div><div class="partner-slider" data-slider tabindex="0" aria-label="${t.partners}">${partnerCards}</div>` : `<p class="empty">${t.partnerEmpty}</p>`}</div></section>` + ctaStrip();
      case 'portfolio': {
        const projects = select('project');
        return pageHero(t.portfolio,t.portfolioIntro) + `<section class="section"><div class="shell">${projects.length ?
          `<div class="grid three">${projects.map(row => `<article class="card">
            ${media(row.image,localized(row.content,'alt',lang),'class="project-image" loading="lazy" decoding="async"')}
            <h2>${tr(row,'title')}</h2><p>${tr(row,'description')}</p>${tr(row,'details') ?
              `<details><summary>${t.details}</summary><p class="preserve">${tr(row,'details')}</p></details>` : ''}</article>`).join('')}</div>` :
          `<div class="empty"><h2>${t.coming}</h2><p>${t.portfolioEmpty}</p></div>`}</div></section>` + ctaStrip();
      }
      case 'contact':
        return pageHero(t.contact,t.contactIntro) + `<section class="section"><div class="shell contact-layout"><div class="contact-list">
          <a href="${phone}">${icon('phone')} <span>${t.call}<strong>${e(contact.phone)}</strong></span></a>
          <a href="${ig}">${icon('instagram')} <span>Instagram<strong>@${e(contact.instagram)}</strong></span></a>
          <a href="${tg}">${icon('telegram')} <span>Telegram<strong>@${e(contact.telegram)}</strong></span></a>
          ${localized(contact,'address',lang) ? `<div class="address"><strong>${t.address}</strong><p>${e(localized(contact,'address',lang))}</p>${contact.maps ? link(contact.maps,t.map,'text-link') : ''}</div>` : ''}
          </div><div class="card form-card" id="request"><h2>${e(cta)}</h2>${form()}</div></div></section>`;
      default:
        return pageHero(t.notFound,'') + `<div class="section shell">${link(p('home'),t.back,'button dark')}</div>`;
    }
  }

  const canonical = page === '404' ? undefined : origin + p(page);
  const alternates = Object.fromEntries(locales.map(locale => [locale, origin + pagePath(locale,page)]));
  alternates['x-default'] = origin + pagePath('uz',page);
  const title = page === 'home' ? name + ' | ' + t.agency : (t[page] || t.notFound) + ' | PROX';
  const branding = '/brand.css?accent=' + encodeURIComponent(brand.content.accent) + '&font=' + encodeURIComponent(brand.content.font);
  return head({lang,title,description:introductions[page],canonical,alternates,image:canonical && origin + (home.image ? '/media/'+home.image : '/assets/signal.svg'),noIndex:page === '404'})
    .replace('</head>', `<link rel="stylesheet" href="${e(branding)}"><link rel="stylesheet" href="/assets/agency.css?v=2"></head>`) +
    `<body class="agency">${header}<main id="main" tabindex="-1">${body()}</main>${footer}</body></html>`;
}
