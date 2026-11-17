const prefix = "/Night-Economy";
const legacyPrefix = "/night";
const olderPrefix = "/night-economy";

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const legacy = [legacyPrefix, olderPrefix].find((base) => incoming.pathname === base || incoming.pathname.startsWith(`${base}/`));
    if (legacy) {
      let legacyPath = incoming.pathname.slice(legacy.length) || "/";
      if (["/", "/trailer", "/public-demo", "/public-demo/"].includes(legacyPath)) legacyPath = "/";
      const legacyAliases = {
        "/tv/public-demo": "/tv-view",
        "/tv/public-demo/": "/tv-view",
        "/menu/public-demo": "/mobile-view",
        "/menu/public-demo/": "/mobile-view",
      };
      const target = legacyAliases[legacyPath] ?? legacyPath;
      return Response.redirect(new URL(`${prefix}/${target.replace(/^\/+/, "")}${incoming.search}`, incoming), 301);
    }
    if (incoming.pathname !== prefix && !incoming.pathname.startsWith(`${prefix}/`)) {
      return new Response("Not found", { status: 404 });
    }

    if (incoming.pathname === prefix) return Response.redirect(new URL(`${prefix}/${incoming.search}`, incoming), 301);

    const assetUrl = new URL(request.url);
    assetUrl.pathname = incoming.pathname.slice(prefix.length) || "/";
    return env.ASSETS.fetch(new Request(assetUrl, request));
  },
};
