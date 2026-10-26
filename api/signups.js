const crypto = require("crypto");
const DATA = require("../data/tasks.json");

const TASKS = new Map(DATA.tasks.map((t) => [t.id, t]));
const KEY = (id) => `yomesumo:${id}`;

// Storage: Upstash Redis on Vercel; in-memory fallback for local testing.
let store;
function getStore() {
  if (store) return store;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const { Redis } = require("@upstash/redis");
    const r = new Redis({ url, token });
    store = {
      async all(ids) {
        const p = r.pipeline();
        ids.forEach((id) => p.hgetall(KEY(id)));
        return (await p.exec()).map((h) => h || {});
      },
      count: (id) => r.hlen(KEY(id)),
      add: (id, sid, val) => r.hset(KEY(id), { [sid]: val }),
      get: (id, sid) => r.hget(KEY(id), sid),
      del: (id, sid) => r.hdel(KEY(id), sid),
    };
  } else {
    const mem = new Map();
    const h = (id) => mem.get(id) || mem.set(id, new Map()).get(id);
    store = {
      async all(ids) { return ids.map((id) => Object.fromEntries(h(id))); },
      async count(id) { return h(id).size; },
      async add(id, sid, val) { h(id).set(sid, val); },
      async get(id, sid) { return h(id).get(sid) ?? null; },
      async del(id, sid) { h(id).delete(sid); },
    };
  }
  return store;
}

const parse = (v) => (typeof v === "string" ? JSON.parse(v) : v);
const clean = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

const isAdminReq = (key) => !!process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
const cleanPhone = (s) => String(s || "").replace(/[^\d+]/g, "").slice(0, 20);

async function snapshot(admin = false) {
  const ids = [...TASKS.keys()];
  const rows = await getStore().all(ids);
  const signups = {};
  ids.forEach((id, i) => {
    signups[id] = Object.entries(rows[i])
      .map(([sid, v]) => ({ sid, ...parse(v) }))
      .sort((a, b) => a.at - b.at)
      .map(({ sid, name, phone, at }) => (admin ? { sid, name, phone: phone || "", at } : { sid, name, at }));
  });
  return signups;
}

module.exports = async function handler(req, res) {
  try {
    const s = getStore();
    const qKey = String(req.headers["x-admin-key"] || "");
    if (req.method === "GET" && new URL(req.url, "http://x").searchParams.get("format") === "csv") {
      if (!isAdminReq(qKey)) return send(res, 403, { error: "Solo la Junta puede exportar." });
      // Key arrives by header only, so it never appears in a link or browser history.
      const signups = await snapshot(true);
      const fronts = Object.fromEntries(DATA.fronts.map((f) => [f.id, f.name]));
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = [["Código", "Frente", "Prioridad", "Tarea", "Fecha límite", "Cupo", "Nombre", "WhatsApp", "Inscrito el"]];
      for (const t of DATA.tasks) {
        const list = signups[t.id];
        const base = [t.id, fronts[t.front], t.priority, t.title, t.due, t.need];
        if (!list.length) rows.push([...base, "", "", ""]);
        for (const x of list) {
          const when = new Date(x.at).toLocaleString("es-CO", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" });
          rows.push([...base, x.name, x.phone, when]);
        }
      }
      const csv = "\uFEFF" + rows.map((r) => r.map(q).join(";")).join("\r\n");
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="doorcolombia-voluntarios.csv"');
      res.setHeader("Cache-Control", "no-store");
      return res.end(csv);
    }
    if (req.method === "GET") {
      const admin = isAdminReq(qKey);
      return send(res, 200, { ...DATA, admin, signups: await snapshot(admin) });
    }

    const body = await readBody(req);
    const admin = isAdminReq(qKey);
    const task = TASKS.get(body.taskId);
    if (!task) return send(res, 400, { error: "Esa tarea no existe." });
    const token = clean(body.token, 64);

    if (req.method === "POST") {
      const name = clean(body.name, 40);
      if (name.length < 2) return send(res, 400, { error: "Escribe tu nombre." });
      const phone = cleanPhone(body.phone);
      if (phone.replace("+", "").length < 8) return send(res, 400, { error: "Escribe tu número de WhatsApp." });
      if (!token) return send(res, 400, { error: "Recarga la página e inténtalo de nuevo." });
      if ((await s.count(task.id)) >= task.need) {
        return send(res, 409, { error: "Esta tarea ya se completó.", signups: await snapshot(admin) });
      }
      const sid = crypto.randomBytes(6).toString("hex");
      await s.add(task.id, sid, JSON.stringify({ name, phone, token, at: Date.now() }));
      return send(res, 200, { sid, signups: await snapshot(admin) });
    }

    if (req.method === "DELETE") {
      const sid = clean(body.sid, 32);
      const current = await s.get(task.id, sid);
      if (!current) return send(res, 200, { signups: await snapshot(admin) });
      if (!admin && parse(current).token !== token) {
        return send(res, 403, { error: "Solo puedes quitar tu propio nombre." });
      }
      await s.del(task.id, sid);
      return send(res, 200, { signups: await snapshot(admin) });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "Método no permitido." });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "No pudimos guardar. Inténtalo de nuevo en un momento." });
  }
};
