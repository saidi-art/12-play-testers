// A2A v1.0 phase-1 stub for 12 Play Testers (play.kubeai.info/a2a).
// Honest input-required response only: no quotes, prices, payments, bookings.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS, POST",
  "Access-Control-Allow-Headers": "Accept, Content-Type, A2A-Version",
  "Content-Type": "application/json; charset=utf-8",
};

const STUB_TEXT =
  "To request a quote: submit the inquiry fields listed at https://play.kubeai.info/availability.json " +
  "to the temporary form endpoint given there, or email quotes@kubeai.info. " +
  "A real person aims to reply within 4h (a target, not a guarantee, applying 24/7). " +
  "Every order stays in pending authorisation until Yacine Zairi, the accountable human, authorises it " +
  "and the client confirms the quote. This endpoint does not issue quotes, prices, or take payment yet.";

const rpc = (id, result) => ({ jsonrpc: "2.0", id: id === undefined ? null : id, result });
const rpcErr = (id, code, message, data) => ({
  jsonrpc: "2.0", id: id === undefined ? null : id,
  error: data === undefined ? { code, message } : { code, message, data },
});
const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body, null, 2) });

exports.handler = async (event) => {
  const m = event.httpMethod;
  if (m === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (m === "GET") {
    return reply(200, {
      endpoint: "https://play.kubeai.info/a2a",
      binding: "JSONRPC",
      protocol_version: "1.0",
      state: "phase_1_stub",
      note: "Send Message is answered with an input-required task pointing at the public intake: the inquiry fields at https://play.kubeai.info/availability.json (temporary form endpoint) or email quotes@kubeai.info. A real person aims to reply within 4h (a target, not a guarantee, 24/7). Every order stays in pending authorisation until Yacine Zairi authorises it and the client confirms the quote. No quotes, prices, or payments are issued through this endpoint yet. Agent Card: https://play.kubeai.info/.well-known/agent-card.json",
    });
  }
  if (m !== "POST") return reply(405, { error: "method_not_allowed", allowed: ["GET", "OPTIONS", "POST"] });

  let parsed;
  try { parsed = JSON.parse(event.body || ""); }
  catch { return reply(400, rpcErr(null, -32700, "Invalid JSON payload")); }

  if (typeof parsed !== "object" || parsed === null || typeof parsed.method !== "string")
    return reply(400, rpcErr(parsed && parsed.id, -32600, "Request payload validation error"));

  const id = parsed.id;
  const method = parsed.method;

  if (method === "GetTask")
    return reply(200, rpcErr(id, -32001, "Task not found", {
      "@type": "TaskNotFoundError",
      note: "Phase 1 stub does not persist tasks. Submit the inquiry via the form documented at https://play.kubeai.info/availability.json or email quotes@kubeai.info.",
    }));

  if (method === "SendMessage" || method === "message/send") {
    const params = parsed.params || {};
    const msg = params.message;
    if (!msg || !Array.isArray(msg.parts))
      return reply(200, rpcErr(id, -32602, "Invalid parameters", { note: "params.message.parts is required" }));

    const now = new Date().toISOString();
    const task = {
      id: crypto.randomUUID(),
      contextId: msg.contextId || crypto.randomUUID(),
      status: {
        state: "TASK_STATE_INPUT_REQUIRED",
        timestamp: now,
        message: {
          messageId: crypto.randomUUID(),
          role: "ROLE_AGENT",
          parts: [{ kind: "text", text: STUB_TEXT }],
          timestamp: now,
          contextId: msg.contextId || undefined,
          taskId: msg.taskId || undefined,
        },
      },
    };
    if (msg.taskId) task.id = msg.taskId;
    return reply(200, rpc(id, task));
  }

  return reply(200, rpcErr(id, -32601, "Method not found", {
    "@type": "MethodNotFoundError",
    supported: ["SendMessage", "GetTask"],
  }));
};
