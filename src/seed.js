export const bilingual = (uz, ru) => ({ uz, ru });
const b = bilingual;

export const categories = {
  smm: { title: b('SMM', 'SMM'), description: b('Ijtimoiy tarmoqlarda strategiya, kontent va reklama.', 'Стратегия, контент и реклама в социальных сетях.') },
  marketing: { title: b('Marketing', 'Маркетинг'), description: b('Brending, reklama va sotuv jarayonlarini tizimli rivojlantirish.', 'Системное развитие бренда, рекламы и продаж.') },
  it: { title: b('IT xizmatlari', 'IT-услуги'), description: b('Saytlar, ilovalar va biznes jarayonlari uchun avtomatlashtirish.', 'Сайты, приложения и автоматизация бизнес-процессов.') }
};

const smm = [
  ['SMM strategiyasi', 'Стратегия SMM', 'Auditoriyani o‘rganish, maqsadlarni belgilash va yo‘l xaritasini tuzish.', 'Изучение аудитории, постановка целей и составление дорожной карты.'],
  ['Kontent yaratish', 'Создание контента', 'Professional videolar, storislar, animatsion materiallar va kreativ dizayn.', 'Профессиональные видео, сторис, анимация и креативный дизайн.'],
  ['Post va storislarni boshqarish', 'Ведение постов и сторис', 'Kontentni muntazam rejalash, sifat nazorati va maqsadli joylashtirish.', 'Регулярное планирование, контроль качества и публикация контента для целевой аудитории.'],
  ['Reklama kampaniyalari', 'Рекламные кампании', 'Instagram va Facebook reklamasi hamda target reklama uchun kreativlar.', 'Реклама в Instagram и Facebook, разработка креативов для таргетированной рекламы.'],
  ['Brend imijini rivojlantirish', 'Развитие имиджа бренда', 'Brendga ishonch va mijozlar bilan mustahkam munosabatlar ustida ishlash.', 'Работа над доверием к бренду и укреплением отношений с клиентами.'],
  ['Tahlil va hisobot', 'Аналитика и отчётность', 'Natijalarni o‘lchash va oylik hisobotlar tayyorlash.', 'Измерение результатов и подготовка ежемесячных отчётов.']
];

const services = {
  smm,
  marketing: [
    ...smm,
    ['Target reklama', 'Таргетированная реклама', 'Maqsadli auditoriyani tanlash, reklama byudjetini optimallashtirish, Google Ads va Telegram Ads.', 'Настройка таргетинга, оптимизация рекламного бюджета, Google Ads и Telegram Ads.'],
    ['Brending', 'Брендинг', 'Logotip, firma uslubi, brendbuk, brend ovozi va imiji.', 'Логотип, фирменный стиль, брендбук, голос и образ бренда.'],
    ['Marketing strategiyasi va konsalting', 'Маркетинговая стратегия и консалтинг', 'Bozor va auditoriya tahlili, strategik rejalash va sotuvlarni yaxshilash bo‘yicha tavsiyalar.', 'Анализ рынка и аудитории, стратегическое планирование и рекомендации по росту продаж.'],
    ['Influenser marketingi', 'Инфлюенс-маркетинг', 'Influenserlarni tanlash va reklama kampaniyalarini boshqarish.', 'Подбор авторов и управление рекламными кампаниями.'],
    ['Sotuv bo‘limini nazorat qilish', 'Сопровождение отдела продаж', 'Sotuv xodimlarini o‘qitish va savdoga tayyorlash.', 'Обучение сотрудников отдела продаж и подготовка к продажам.'],
    ['Sotuv jarayonini to‘liq nazorat qilish', 'Полное сопровождение продаж', 'Sotuv jarayonining barcha bosqichlarini tizimli kuzatish va boshqarish.', 'Системный контроль и управление всеми этапами продаж.']
  ],
  it: [
    ['Veb-saytlar yaratish', 'Разработка сайтов', 'Landing sahifalar, korporativ saytlar va internet-do‘konlar.', 'Лендинги, корпоративные сайты и интернет-магазины.'],
    ['Mobil ilovalar yaratish', 'Разработка мобильных приложений', 'iOS va Android uchun ilovalar.', 'Приложения для iOS и Android.'],
    ['Onlayn buyurtma va to‘lov integratsiyasi', 'Интеграция онлайн-заказов и платежей', 'Onlayn buyurtma qabul qilish va to‘lov tizimlarini ulash.', 'Подключение приёма онлайн-заказов и платёжных систем.'],
    ['UI/UX dizayn', 'UI/UX-дизайн', 'Foydalanish uchun qulay va brendga mos interfeyslar.', 'Удобные интерфейсы в фирменном стиле.'],
    ['Texnik yordam', 'Техническая поддержка', 'Texnik xizmat, xavfsizlik va yangilanishlar.', 'Обслуживание, безопасность и обновления.'],
    ['Sun’iy intellekt va botlar', 'Искусственный интеллект и боты', 'Telegram botlari, Instagram uchun AI-chatbotlar va biznes akkauntlari bilan integratsiya.', 'Боты Telegram, ИИ-чатботы для Instagram и интеграция с бизнес-аккаунтами.']
  ]
};

const entries = [
  ...Object.entries(services).flatMap(([category, items]) => items.map(([uz, ru, descUz, descRu], position) =>
    ['service', category, position, { title: b(uz, ru), description: b(descUz, descRu) }])),
  ...[1500, 1350, 1200, 1000].map((amount, position) => {
    const months = [1, 3, 6, 12][position];
    return ['price', 'smm', position, { amount, months, title: b('SMM paketi', 'Пакет SMM'), description: b('Paket muddati uchun oylik narx.', 'Ежемесячная стоимость при выбранном сроке.') }];
  }),
  ['price', 'marketing', 0, { amount: 2000, title: b('Marketing', 'Маркетинг'), description: b('Yakuniy narx loyiha hajmi va individual talablarga bog‘liq.', 'Итоговая стоимость зависит от объёма проекта и индивидуальных требований.') }],
  ['price', 'it', 0, { title: b('Individual smeta', 'Индивидуальная смета'), description: b('Narx loyihaning vazifalari va texnik talablariga qarab hisoblanadi.', 'Стоимость рассчитывается по задачам и техническим требованиям проекта.') }]
];

const settings = {
  home: {
    headline: b('Biznesingiz uchun tizimli o‘sish.', 'Системный рост для вашего бизнеса.'),
    description: b('SMM, marketing va IT yechimlarini biznesingiz maqsadlariga mos strategiyada birlashtiramiz.', 'Объединяем SMM, маркетинг и IT-решения в стратегии, которая отвечает целям вашего бизнеса.'),
    cta: b('Bepul konsultatsiya olish', 'Получить бесплатную консультацию'),
    strength1Title: b('Strategiyadan boshlaymiz', 'Начинаем со стратегии'),
    strength1Text: b('Auditoriya, bozor va maqsadlarni o‘rganib, ish rejasini tuzamiz.', 'Изучаем аудиторию, рынок и цели, затем составляем план работ.'),
    strength2Title: b('Jarayonlarni bog‘laymiz', 'Связываем процессы'),
    strength2Text: b('Kontent, reklama va texnologiyalarni yagona yo‘nalishda olib boramiz.', 'Выстраиваем контент, рекламу и технологии в одном направлении.'),
    strength3Title: b('Natijalarni o‘lchaymiz', 'Измеряем результаты'),
    strength3Text: b('Ko‘rsatkichlarni kuzatamiz va muntazam hisobot beramiz.', 'Отслеживаем показатели и регулярно предоставляем отчёты.')
  },
  about: {
    intro: b('PROX — biznesni raqamli muhitda tizimli rivojlantirish va sotuvlarni oshirishga yo‘naltirilgan marketing agentligi.', 'PROX — агентство цифрового маркетинга, которое помогает бизнесу системно развиваться и увеличивать продажи.'),
    mission: b('Strategiya, kreativ va texnologiyalar yordamida biznesning o‘sishiga ko‘maklashish.', 'Помогать бизнесу расти с помощью стратегии, креатива и технологий.'),
    values: b('Aniq maqsadlar, ochiq muloqot va o‘lchanadigan natijalarga e’tibor.', 'Ясные цели, открытое общение и внимание к измеримым результатам.')
  },
  contact: { phone: '+998 20 026 04 18', instagram: 'prox_uz', telegram: 'manager_prox', address: b('', ''), maps: '' },
  brand: { accent: '#d8fc63', font: 'system', portfolioNav: true }
};

export function seed(db) {
  const addCategory = db.prepare('INSERT INTO categories(id,position,content) VALUES (?,?,?)');
  const addEntry = db.prepare('INSERT INTO entries(kind,category,position,content) VALUES (?,?,?,?)');
  const addSettings = db.prepare('INSERT INTO settings(key,content) VALUES (?,?)');
  Object.entries(categories).forEach(([id, content], position) => addCategory.run(id, position, JSON.stringify(content)));
  entries.forEach(([kind, category, position, content]) => addEntry.run(kind, category, position, JSON.stringify(content)));
  Object.entries(settings).forEach(([key, content]) => addSettings.run(key, JSON.stringify(content)));
}
