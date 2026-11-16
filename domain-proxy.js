const prefix = "/night-economy";
const legacyPrefix = "/night";
const pagesOrigin = "https://night-economy.pages.dev";

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.pathname === legacyPrefix || incoming.pathname.startsWith(`${legacyPrefix}/`)) {
      const legacyPath = incoming.pathname.slice(legacyPrefix.length) || "/";
      const legacyAliases = {
        "/": "/portal",
        "/public-demo": "/portal",
        "/public-demo/": "/portal",
        "/tv/public-demo": "/tv-view",
        "/tv/public-demo/": "/tv-view",
        "/menu/public-demo": "/mobile-view",
        "/menu/public-demo/": "/mobile-view",
      };
      const target = legacyAliases[legacyPath] ?? legacyPath;
      return Response.redirect(new URL(`${prefix}${target}${incoming.search}`, incoming), 301);
    }
    if (incoming.pathname !== prefix && !incoming.pathname.startsWith(`${prefix}/`)) {
      return new Response("Not found", { status: 404 });
    }

    if (incoming.pathname === prefix || incoming.pathname === `${prefix}/`) {
      return Response.redirect(new URL(`${prefix}/portal${incoming.search}`, incoming), 302);
    }

    const upstream = new URL(pagesOrigin);
    upstream.pathname = incoming.pathname.slice(prefix.length) || "/";
    upstream.search = incoming.search;

    return fetch(new Request(upstream, request));
  },
};
