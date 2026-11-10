const zone = { timeZone: 'Asia/Tashkent' };
const day = new Intl.DateTimeFormat('en-GB', { ...zone, dateStyle: 'short' });
const clock = new Intl.DateTimeFormat('en-GB', { ...zone, timeStyle: 'medium', hourCycle: 'h23' });
const serviceNames = { smm: 'SMM', marketing: 'Marketing', it: 'IT' };

function leadMessage(lead) {
  const submitted = new Date(lead.created_at.replace(' ', 'T') + 'Z');
  return [
    '🔔 YANGI BUYURTMA — PROX MARKETING', '',
    '👤 Mijoz: ' + lead.name,
    '📞 Telefon: ' + lead.phone,
    '📌 Xizmat: ' + serviceNames[lead.category],
    '💬 Izoh: ' + (lead.message || '—'),
    '📅 Sana: ' + day.format(submitted),
    '🕒 Vaqt: ' + clock.format(submitted),
    '🆔 Buyurtma ID: ' + lead.id
  ].join('\n');
}

export function telegramClient({ token, chatId }, send = fetch) {
  const configured = Boolean(token && /^-?\d+$/.test(chatId ?? ''));
  async function deliver(text) {
    if (!configured) return { ok: false };
    try {
      const response = await send('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
        signal: AbortSignal.timeout(8_000)
      });
      const result = await response.json();
      return {
        ok: response.ok && result?.ok === true,
        retryAfterMs: Math.max(0, Number(result?.parameters?.retry_after) || 0) * 1000
      };
    } catch {
      // Fetch errors can include the bot URL. Return a safe failure without logging it.
      return { ok: false };
    }
  }
  return {
    configured, deliver,
    test: () => deliver('🧪 PROX MARKETING — Telegram sinov xabari')
  };
}

export function telegramWorker(db, telegram) {
  let running = false;
  return async function drain() {
    if (running || !telegram.configured) return;
    running = true;
    try {
      const leads = db.prepare(`SELECT * FROM leads WHERE telegram IN ('pending','failed','sending')
        AND next_attempt<=? ORDER BY next_attempt,id LIMIT 10`).all(Date.now());
      for (const lead of leads) {
        const now = Date.now();
        const claimed = db.prepare(`UPDATE leads SET telegram='sending',attempts=attempts+1,next_attempt=?,updated_at=CURRENT_TIMESTAMP
          WHERE id=? AND telegram<>'sent' AND next_attempt<=?`).run(now + 60_000, lead.id, now);
        if (!claimed.changes) continue;
        const result = await telegram.deliver(leadMessage(lead));
        if (result.ok) {
          db.prepare("UPDATE leads SET telegram='sent',next_attempt=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(lead.id);
        } else {
          const delay = Math.min(24 * 60 * 60_000, 30_000 * 2 ** Math.min(lead.attempts, 12));
          const next = Date.now() + Math.max(delay, result.retryAfterMs ?? 0);
          db.prepare("UPDATE leads SET telegram='failed',next_attempt=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(next, lead.id);
        }
      }
    } finally {
      running = false;
    }
  };
}
