// A2A v1.0 quote endpoint for 12 Play Testers (play.kubeai.info/a2a) - Phase 2.
// request_quote is email-backed: a complete inquiry goes through the same Formspree
// form the web form uses, so it lands in the quotes@kubeai.info inbox. Tasks persist
// (Netlify Blobs) so a client can resume by taskId via tasks/get.
// No prices are invented here: a flat-fee quote is issued automatically only when
// QUOTE_FLAT_FEE_USD is configured for the function. Until then the quote is prepared
// by a real person within the 4h target (the standing SLA). Every order stays
// pending authorisation until Yacine Zairi authorises it and the client confirms the
// quote. Payment is never taken through this endpoint; no AP2/x402/ACP/UCP.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
  "Access-Control-Allow-Headers": "Accept, Content-Type, A2A-Version",
  "Content-Type": "application/json; charset=utf-8",
};

const CARD_URL = "https://play.kubeai.info/.well-known/agent-card.json";
const FORMSPREE = "https://formspree.io/f/xqppdyqb";
const CATEGORIES = ["Productivity", "Games", "Education", "Health and fitness",
  "Finance", "Social and communication", "Tools and utilities", "Lifestyle", "Other"];
const CONTACT_VIA = ["Email", "WhatsApp", "Telegram"];

const rpc = (id, result) => ({ jsonrpc: "2.0", id: id === undefined ? null : id, result });
const rpcErr = (id, code, message, data) => ({
  jsonrpc: "2.0", id: id === undefined ? null : id,
  error: data === undefined ? { code, message } : { code, message, data },
});
const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body, null, 2) });

// ---- persistence ----------------------------------------------------------
let _store; // undefined = not tried, false = unavailable, object = store
const _mem = new Map();
function store() {
  if (_store !== undefined) return _store;
  try {
    const { getStore } = require("@netlify/blobs");
    _store = getStore({ name: "a2a_tasks", consistency: "strong" });
  } catch (e) { _store = false; _storeErr = String(e && e.message || e).slice(0, 200); }
  return _store;
}
let _storeErr;
async function putTask(t) {
  _mem.set(t.id, t);
  const s = store();
  if (s) { try { await s.setJSON(t.id, t); await s.setJSON("mid:" + (t.lastMessageId || "none"), { taskId: t.id }); } catch (e) {} }
  return t;
}
async function loadTask(id) {
  const s = store();
  if (s) { try { const t = await s.get(id, { type: "json" }); if (t) { _mem.set(id, t); return t; } } catch (e) {} }
  return _mem.get(id) || null;
}
async function findByMessageId(mid) {
  if (!mid) return null;
  const s = store();
  let hit = null;
  if (s) { try { hit = await s.get("mid:" + mid, { type: "json" }); } catch (e) {} }
  if (hit && hit.taskId) return loadTask(hit.taskId);
  return null;
}

// ---- helpers --------------------------------------------------------------
const now = () => new Date().toISOString();
const agentMsg = (parts, taskId, contextId) => ({
  kind: "message", messageId: crypto.randomUUID(), role: "ROLE_AGENT",
  parts, taskId, contextId, timestamp: now(),
});

function extractFields(msg) {
  const f = {};
  const scan = (o) => {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      const key = k.toLowerCase().replace(/[^a-z_]/g, "_");
      if (typeof v === "string" || typeof v === "number") {
        const val = String(v).trim();
        if (val) f[key] = val;
      }
    }
  };
  for (const p of msg.parts || []) {
    if (p.kind === "data" && p.data) scan(p.data);
    else if (p.kind === "text" && typeof p.text === "string") {
      const t = p.text.trim();
      if (t.startsWith("{")) { try { scan(JSON.parse(t)); } catch (e) {} }
      const re = /^\s*([A-Za-z_ ]{3,20})\s*[:=]\s*(.+)$/gm; let m;
      while ((m = re.exec(t))) {
        const key = m[1].toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z_]/g, "_");
        const val = m[2].trim();
        if (val && !f[key]) f[key] = val;
      }
      if (!f.message && t.length > 12) f.message = f.message || t.slice(0, 500);
    }
  }
  // label aliases from the public intake field list
  const alias = (out, key) => { for (const k of key) if (f[k] !== undefined) { out = f[k]; break; } return out; };
  const pick = (...keys) => { for (const k of keys) if (f[k] !== undefined) return f[k]; return undefined; };
  return {
    app_name: pick("app_name", "app", "appname"),
    category: pick("category"),
    console: pick("console", "console_account"),
    profile: pick("profile", "developer_profile"),
    email: pick("email", "e_mail"),
    contact_via: pick("contact_via", "contact", "preferred_contact"),
    handle: pick("handle", "username"),
    message: pick("message", "notes", "details"),
  };
}

function missingFields(fl) {
  const missing = [];
  if (!fl.app_name) missing.push("app_name");
  if (!fl.category) missing.push("category (one of: " + CATEGORIES.join(", ") + ")");
  if (!fl.console) missing.push("console ('Console account registered' or 'Needs setup guidance')");
  if (!fl.profile) missing.push("profile ('Solo creator, flat-rate' or 'Multiple apps or studio')");
  if (!fl.email) missing.push("email");
  else if (fl.contact_via && !/email/i.test(fl.contact_via) && !fl.handle) missing.push("handle (your " + fl.contact_via + " contact, since contact_via is not Email)");
  return missing;
}

async function sendInquiry(task, fl, subjectTag) {
  const body = {
    _subject: subjectTag + " - " + (fl.app_name || "unnamed app") + " (A2A task " + task.id + ")",
    _gotcha: "",
    app_name: fl.app_name || "", category: fl.category || "", console: fl.console || "",
    profile: fl.profile || "", email: fl.email || "", contact_via: fl.contact_via || "Email",
    handle: fl.handle || "", message: fl.message || "",
    a2a_task_id: task.id, a2a_context_id: task.contextId, a2a_source: subjectTag,
  };
  try {
    const r = await fetch(FORMSPREE, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch (e) { return false; }
}

function quoteArtifact(fee, task) {
  const data = {
    service: "Managed Google Play closed test",
    testers_per_app: 12, duration_days: 14,
    pricing_model: "quote-based", billing: "one-time flat rate",
    flat_fee_usd: fee, currency: "USD",
    order_status: "pending_authorization",
    approvals: {
      human: "Yacine Zairi (accountable human) must authorise the order",
      client: "the client must confirm the quote",
    },
    payment: "never taken through the A2A endpoint; arranged by a human",
    task_id: task.id,
  };
  const text = "Flat-rate quote: USD " + fee + " one-time for the managed 14-day, 12-tester closed test of " +
    "your app. This quote is not binding until Yacine Zairi authorises it and you confirm it. " +
    "Payment is never taken through this endpoint. Nothing is engaged or arranged until both approvals are in.";
  return { artifactId: crypto.randomUUID(), name: "flat-rate quote",
    mimeType: "application/json", parts: [{ kind: "data", data }, { kind: "text", text }] };
}

// ---- task handling --------------------------------------------------------
async function handleSend(parsed, event) {
  const params = parsed.params || {};
  const msg = params.message;
  if (!msg || !Array.isArray(msg.parts))
    return rpcErr(parsed.id, -32602, "Invalid parameters", { note: "params.message.parts is required" });

  const fl = extractFields(msg);
  const meta = msg.metadata || params.metadata || {};
  const skill = meta.skill_id || meta.skill || (typeof msg.text === "string" && msg.text.includes("book_cohort")) ||
    (JSON.stringify(msg.parts || []).includes("book_cohort") ? "book_cohort" : "request_quote");

  // resume an existing task by taskId
  let task = null;
  if (msg.taskId) {
    task = await loadTask(msg.taskId);
    if (!task) return rpcErr(parsed.id, -32001, "Task not found", { "@type": "TaskNotFoundError" });
  } else if (msg.messageId) {
    const prev = await findByMessageId(msg.messageId); // idempotent re-send
    if (prev) return rpc(parsed.id, prev);
  }

  const ts = now();
  if (!task) {
    task = { kind: "task", id: "task-" + crypto.randomUUID(), contextId: msg.contextId || crypto.randomUUID(),
      createdAt: ts, history: [], seenFields: {} };
  }
  task.lastMessageId = msg.messageId || undefined;
  task.updatedAt = ts;
  task.history.push({ kind: "message", messageId: msg.messageId || crypto.randomUUID(),
    role: msg.role || "ROLE_USER", parts: msg.parts, taskId: task.id, contextId: task.contextId, timestamp: ts });

  if (skill === "book_cohort") return bookCohort(task, meta, msg);
  return requestQuote(task, fl, msg);
}

async function requestQuote(task, fl, msg) {
  // merge resumed fields
  for (const [k, v] of Object.entries(fl)) if (v !== undefined) task.seenFields[k] = v;
  const merged = { ...task.seenFields };
  const missing = missingFields(merged);

  if (missing.length) {
    task.status = { state: "TASK_STATE_INPUT_REQUIRED", timestamp: now(), message: agentMsg(
      [{ kind: "text", text: "To prepare your flat-rate, no-obligation quote I need a few details. Please reply with: " +
        missing.map((m) => "- " + m).join("; ") +
        ". The full intake field list is at https://play.kubeai.info/availability.json. " +
        "Nothing is arranged from a quote request: every order stays pending authorisation until " +
        "Yacine Zairi authorises it and you confirm the quote. Payment is never taken through this endpoint." }],
      task.id, task.contextId) };
    await putTask(task);
    return task;
  }

  // normalize + validate category loosely (accept any value, note non-standard ones)
  if (!CATEGORIES.includes(merged.category)) merged.category_note = "non-standard category value";

  if (!task.inquirySent) {
    task.inquirySent = await sendInquiry(task, merged, "[A2A] Quote request");
    task.inquirySentAt = task.inquirySent ? now() : undefined;
  }

  const fee = process.env.QUOTE_FLAT_FEE_USD && process.env.QUOTE_FLAT_FEE_USD.trim();
  if (fee) {
    const art = quoteArtifact(fee, task);
    task.artifacts = [art];
    task.status = { state: "TASK_STATE_AUTH_REQUIRED", timestamp: now(), message: agentMsg(
      [{ kind: "text", text: art.parts[1].text }], task.id, task.contextId) };
  } else {
    task.status = { state: "TASK_STATE_WORKING", timestamp: now(), message: agentMsg(
      [{ kind: "text", text: "Your quote request is logged (task " + task.id + "). A real person aims to reply with " +
        "your flat-rate, no-obligation quote within 4h (a target, not a guarantee, 24/7). The quote is not binding " +
        "until Yacine Zairi authorises it and you confirm it. Payment is never taken through this endpoint." }],
      task.id, task.contextId) };
  }
  await putTask(task);
  return task;
}

async function bookCohort(task, meta, msg) {
  const qid = meta.quote_task_id || meta.quoteTaskId;
  if (!qid) {
    task.status = { state: "TASK_STATE_INPUT_REQUIRED", timestamp: now(), message: agentMsg(
      [{ kind: "text", text: "A cohort booking needs a quote first. Use the request_quote skill to get one, then " +
        "send book_cohort again with metadata.quote_task_id set to that quote's task id. The order will start in " +
        "pending authorisation: Yacine Zairi must authorise it and you must confirm the quote before testers are " +
        "engaged or payment is arranged. Payment is never taken through this endpoint." }],
      task.id, task.contextId) };
    await putTask(task);
    return task;
  }
  const quoteTask = await loadTask(qid);
  if (!quoteTask || !(quoteTask.artifacts && quoteTask.artifacts.length) || quoteTask.status.state !== "TASK_STATE_AUTH_REQUIRED") {
    task.status = { state: "TASK_STATE_INPUT_REQUIRED", timestamp: now(), message: agentMsg(
      [{ kind: "text", text: "I could not find an issued, authorisable quote for task id " + qid + ". Get a quote with " +
        "the request_quote skill first, then resend book_cohort with that quote's task id. Payment is never taken " +
        "through this endpoint." }], task.id, task.contextId) };
    await putTask(task);
    return task;
  }
  task.status = { state: "TASK_STATE_AUTH_REQUIRED", timestamp: now(), message: agentMsg(
    [{ kind: "text", text: "Cohort booking request logged (order task " + task.id + ", quote task " + qid + "). " +
      "The order starts in pending authorisation: Yacine Zairi must authorise it and you must confirm the quote " +
      "before testers are engaged or payment is arranged. Payment is never taken through this endpoint." }],
    task.id, task.contextId) };
  task.relatedTasks = [qid];
  await sendInquiry(task, { ...quoteTask.seenFields, message: "BOOKING REQUEST (A2A book_cohort) for quote task " + qid }, "[A2A] Booking request");
  await putTask(task);
  return task;
}

// ---- handler --------------------------------------------------------------
exports.handler = async (event) => {
  const m = event.httpMethod;
  if (m === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  // A2A-Version: header or query param (spec 3.6). Empty value means 0.3 -> unsupported.
  const vRaw = (event.headers && (event.headers["a2a-version"] || event.headers["A2A-Version"])) ||
    (event.queryStringParameters && event.queryStringParameters["A2A-Version"]);
  const versionOk = vRaw === undefined || vRaw === null ? true : (String(vRaw).trim() === "1.0");

  if (m === "GET") {
    let blobCheck;
    {
      const s2 = store();
      if (!s2) blobCheck = "store_get_err:" + String(_storeErr || "unavailable");
      else try {
        await s2.setJSON("diag:ping", { t: now() });
        const v = await s2.get("diag:ping", { type: "json" });
        blobCheck = v ? "store_ok" : "store_write_ok_read_miss";
      } catch (e) { blobCheck = "store_err:" + String(e && e.message || e).slice(0, 140); }
    }
    return reply(200, {
      blob_check: blobCheck,
      endpoint: "https://play.kubeai.info/a2a",
      binding: "JSONRPC",
      protocol_version: "1.0",
      state: "phase_2_live",
      note: "Send Message (skills request_quote, book_cohort): complete requests are logged and answered with a " +
        "flat-rate quote (as an artifact when automatic quoting is configured, otherwise a reply by email) within " +
        "the 4h target (a target, not a guarantee, 24/7). Get Task (tasks/get) resumes by taskId. Streaming and push " +
        "notifications are not supported. Every order stays pending authorisation until Yacine Zairi authorises it " +
        "and the client confirms the quote. Payment is never taken through this endpoint. " +
        "Agent Card: " + CARD_URL,
    });
  }
  if (m !== "POST") return reply(405, { error: "method_not_allowed", allowed: ["GET", "OPTIONS", "POST"] });
  if (!versionOk)
    return reply(400, rpcErr(null, -32009, "Version not supported", {
      "@type": "VersionNotSupportedError", supported: ["1.0"],
      note: "Send the A2A-Version: 1.0 header (or ?A2A-Version=1.0).",
    }));

  let parsed;
  try { parsed = JSON.parse(event.body || ""); }
  catch (e) { return reply(400, rpcErr(null, -32700, "Invalid JSON payload")); }

  const one = async (req) => {
    if (typeof req !== "object" || req === null || typeof req.method !== "string")
      return rpcErr(req && req.id, -32600, "Request payload validation error");
    const method = req.method;
    if (method === "SendMessage" || method === "message/send") {
      try {
        const r = await handleSend(req, event);
        return (r && r.jsonrpc) ? r : rpc(req.id, r);
      }
      catch (e) { return rpcErr(req.id, -32603, "Internal error"); }
    }
    if (method === "GetTask" || method === "tasks/get") {
      const p = req.params || {};
      const id = p.taskId || p.id;
      if (!id) return rpcErr(req.id, -32602, "Invalid parameters", { note: "params.taskId is required" });
      const t = await loadTask(id);
      if (!t) return rpcErr(req.id, -32001, "Task not found", { "@type": "TaskNotFoundError" });
      return rpc(req.id, t);
    }
    if (/stream|resubscribe/i.test(method))
      return rpcErr(req.id, -32004, "Unsupported operation", {
        "@type": "UnsupportedOperationError", note: "Streaming is not supported by this agent (capabilities.streaming is false).",
      });
    if (/pushnotification/i.test(method))
      return rpcErr(req.id, -32003, "Push notification not supported", {
        "@type": "PushNotificationNotSupportedError", note: "Push notifications are not supported by this agent (capabilities.pushNotifications is false).",
      });
    return rpcErr(req.id, -32601, "Method not found", { "@type": "MethodNotFoundError", supported: ["SendMessage", "message/send", "GetTask", "tasks/get"] });
  };

  if (Array.isArray(parsed)) {
    const out = [];
    for (const req of parsed) { const r = await one(req); if (!(r && r.result && r.result.id === undefined)) out.push(r); }
    return reply(200, out.length ? out : null);
  }
  const res = await one(parsed);
  return reply(200, res);
};
