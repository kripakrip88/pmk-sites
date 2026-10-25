// Общая логика формы заявки → PocketBase (коллекция leads). Вёрстка формы — у каждого сайта своя,
// контракт разметки такой:
//   <form data-lead-form>                      — сама форма
//     name="phone" (обязательно), "name", "comment", "files" (type=file multiple),
//     "consent" (checkbox), "website" (скрытая ловушка для ботов)
//     [data-lead-status]                       — сюда пишется статус; data-state = ok|error|busy
//     [data-lead-files]                        — подпись «прикреплено файлов: N» (необязательно)
// На сервере nginx проксирует /api/ в PocketBase на том же домене; для локальной разработки —
// переменная PUBLIC_PB_URL при сборке.
import site from './site.js';
import { goal } from './goal.js';

const PB = import.meta.env.PUBLIC_PB_URL ?? '';
const MAX = 20 * 1024 * 1024;

export function initLeadForms() {
  for (const form of document.querySelectorAll('form[data-lead-form]')) {
    const status = form.querySelector('[data-lead-status]');
    const btn = form.querySelector('[type=submit]');
    const fileInput = form.querySelector('input[type=file]');
    const filesLabel = form.querySelector('[data-lead-files]');
    const filesLabelDefault = filesLabel?.textContent;

    const say = (text, state) => {
      if (!status) return;
      status.textContent = text;
      status.dataset.state = state;
    };

    fileInput?.addEventListener('change', () => {
      const n = fileInput.files?.length ?? 0;
      if (filesLabel) filesLabel.textContent = n ? `Прикреплено файлов: ${n}` : filesLabelDefault;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      if (String(fd.get('phone') || '').replace(/\D/g, '').length < 10) return say('Укажите телефон — нам нужно куда перезвонить.', 'error');
      if (!fd.get('consent')) return say('Отметьте согласие на обработку данных.', 'error');
      const files = [...(fileInput?.files ?? [])];
      if (files.some((f) => f.size > MAX)) return say('Файл больше 20 МБ — отправьте его в мессенджер.', 'error');

      fd.set('consent', 'true');
      fd.set('site', site.slug);
      fd.set('page', location.href.slice(0, 500));
      const utm = Object.fromEntries([...new URLSearchParams(location.search)].filter(([k]) => /^(utm_|yclid)/.test(k)));
      fd.set('utm', JSON.stringify(utm));
      fd.delete('files');
      for (const f of files) fd.append('files', f);

      if (btn) btn.disabled = true;
      say('Отправляем…', 'busy');
      try {
        const res = await fetch(`${PB}/api/collections/leads/records`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error(String(res.status));
        goal('lead_sent');
        form.reset();
        if (filesLabel) filesLabel.textContent = filesLabelDefault;
        say('Заявка отправлена. Перезвоним в рабочее время.', 'ok');
      } catch {
        say('Не получилось отправить. Позвоните нам — примем заявку по телефону.', 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    });
  }
}
