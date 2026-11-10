export default async (request: Request, context: Context) => {
  const accept = request.headers.get("accept") || "";
  if (!accept.includes("text/markdown")) {
    return context.next();
  }
  const md = await fetch(new URL("/content.md", request.url));
  const body = await md.text();
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "vary": "Accept",
    },
  });
};

export const config = { path: "/" };
