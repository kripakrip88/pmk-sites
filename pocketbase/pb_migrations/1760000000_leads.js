/// <reference path="../pb_data/types.d.ts" />
// Коллекция заявок со всех сайтов. Создавать может любой (форма), читать — только суперюзер.
migrate((app) => {
  const leads = new Collection({
    type: "base",
    name: "leads",
    listRule: null,
    viewRule: null,
    createRule: "",
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "site", type: "text", required: true, max: 100 },
      { name: "phone", type: "text", required: true, max: 50 },
      { name: "name", type: "text", max: 200 },
      { name: "comment", type: "text", max: 5000 },
      // чертежи клиентов — protected: скачать можно только с токеном
      { name: "files", type: "file", maxSelect: 5, maxSize: 20 * 1024 * 1024, protected: true },
      { name: "consent", type: "bool", required: true },
      { name: "page", type: "text", max: 500 },
      { name: "utm", type: "json", maxSize: 4000 },
      { name: "ip", type: "text", max: 64 },
      { name: "notified", type: "select", maxSelect: 1, values: ["ok", "error"] },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE INDEX idx_leads_site ON leads (site)"],
  });
  app.save(leads);

  // не больше 5 заявок в минуту с одного IP
  const settings = app.settings();
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [
    { label: "POST /api/collections/leads/records", maxRequests: 5, duration: 60, audience: "" },
    { label: "*:auth", maxRequests: 10, duration: 60, audience: "" },
  ];
  // за nginx реальный IP посетителя — в X-Real-IP (иначе лимит считал бы всех за один IP)
  settings.trustedProxy.headers = ["X-Real-IP"];
  app.save(settings);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("leads"));
});
