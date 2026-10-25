/// <reference path="../pb_data/types.d.ts" />
// Заявка с сайта: отсекаем ботов, пишем IP, после сохранения — письмо и вебхук в n8n.
// Переменные окружения:
//   LEADS_EMAIL      — куда слать письмо о заявке (пусто — не слать)
//   N8N_WEBHOOK_URL  — вебхук n8n (пусто — не слать)
//   PB_PUBLIC_URL    — адрес админки PocketBase для ссылки в письме

onRecordCreateRequest((e) => {
  const body = e.requestInfo().body;
  // honeypot: скрытое поле «website» заполняют только боты
  if (body.website) throw new BadRequestError("rejected");
  if (!e.record.getBool("consent")) throw new BadRequestError("consent required");
  e.record.set("ip", e.realIP());
  e.record.set("notified", "");
  e.next();
}, "leads");

onRecordAfterCreateSuccess((e) => {
  e.next();

  const r = e.record;
  const lead = {
    id: r.id,
    site: r.getString("site"),
    phone: r.getString("phone"),
    name: r.getString("name"),
    comment: r.getString("comment"),
    files: r.getStringSlice("files"),
    page: r.getString("page"),
    utm: JSON.parse(r.getString("utm") || "{}"),
    created: r.getString("created"),
    admin_url: ($os.getenv("PB_PUBLIC_URL") || "") + "/_/#/collections?collection=leads&recordId=" + r.id,
  };
  let ok = true;

  const hook = $os.getenv("N8N_WEBHOOK_URL");
  if (hook) {
    try {
      const res = $http.send({
        url: hook,
        method: "POST",
        body: JSON.stringify(lead),
        headers: { "content-type": "application/json" },
        timeout: 10,
      });
      if (res.statusCode >= 300) throw new Error("n8n status " + res.statusCode);
    } catch (err) {
      ok = false;
      e.app.logger().error("lead webhook failed", "lead", r.id, "error", String(err));
    }
  }

  const to = $os.getenv("LEADS_EMAIL");
  if (to) {
    try {
      const esc = (s) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      const rows = [
        ["Сайт", lead.site], ["Телефон", lead.phone], ["Имя", lead.name],
        ["Что нужно", lead.comment], ["Файлов", lead.files.length], ["Страница", lead.page],
        ["UTM", JSON.stringify(lead.utm || {})],
      ];
      const html = "<table>" + rows.map(([k, v]) => "<tr><td><b>" + k + "</b></td><td>" + esc(v) + "</td></tr>").join("") +
        "</table><p><a href=\"" + esc(lead.admin_url) + "\">Открыть заявку и файлы</a></p>";
      const meta = e.app.settings().meta;
      e.app.newMailClient().send(new MailerMessage({
        from: { address: meta.senderAddress, name: meta.senderName },
        to: [{ address: to }],
        subject: "Заявка с " + lead.site + ": " + lead.phone,
        html: html,
      }));
    } catch (err) {
      ok = false;
      e.app.logger().error("lead email failed", "lead", r.id, "error", String(err));
    }
  }

  if (hook || to) {
    r.set("notified", ok ? "ok" : "error");
    e.app.unsafeWithoutHooks().save(r);
  }
}, "leads");
