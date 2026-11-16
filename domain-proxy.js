const prefix = "/night";
const pagesOrigin = "https://night-economy.pages.dev";

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.pathname !== prefix && !incoming.pathname.startsWith(`${prefix}/`)) {
      return new Response("Not found", { status: 404 });
    }

    const upstream = new URL(pagesOrigin);
    upstream.pathname = incoming.pathname.slice(prefix.length) || "/";
    upstream.search = incoming.search;

    return fetch(new Request(upstream, request));
  },
};
