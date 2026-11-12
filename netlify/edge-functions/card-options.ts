// A2A Agent Card (/.well-known/agent-card.json): answer ANY OPTIONS with 200 and an
// empty body plus the card's CORS headers (next-steps pack item 3, 12 Nov 2026).
// Rationale: Netlify serves CORS preflights (Origin + Access-Control-Request-Method)
// from the header rules in netlify.toml, but a plain OPTIONS (no preflight header)
// fell through to the static handler and returned 404 "Not Found". Simpler clients
// that send a bare OPTIONS now get the same 200 as /a2a. GET is untouched: it passes
// through to the static file, so bytes, Content-Type and Cache-Control are unchanged.
export default async (request: Request, context: Context) => {
  if (request.method === "OPTIONS") {
    return new Response("", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Accept, Content-Type, A2A-Version, A2A-Extensions",
      },
    });
  }
  return context.next();
};

export const config = { path: "/.well-known/agent-card.json" };
