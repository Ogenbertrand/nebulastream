export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "healthy", service: "edge-proxy" }),
        { headers: { "content-type": "application/json" } }
      );
    }

    if (url.pathname === "/proxy/headers") {
      const target = url.searchParams.get("url");
      if (!target) return new Response("Missing url", { status: 400 });

      const res = await fetch(target, { method: "HEAD" });
      const headers = {};
      res.headers.forEach((v, k) => (headers[k] = v));

      return new Response(JSON.stringify({ url: target, status: res.status, headers }), {
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
        },
      });
    }

    if (url.pathname === "/proxy") {
      const target = url.searchParams.get("url");
      if (!target) return new Response("Missing url", { status: 400 });

      const res = await fetch(target, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: "manual",
      });

      const headers = new Headers(res.headers);
      headers.set("access-control-allow-origin", "*");
      headers.set("access-control-allow-methods", "GET,OPTIONS");
      headers.set("access-control-allow-headers", "*");

      return new Response(res.body, { status: res.status, headers });
    }

    return new Response("Not Found", { status: 404 });
  },
};
