type AppSurface = "site" | "trailer" | "tv" | "menu" | "app" | "venue" | "sign-in" | "simulator" | "logo" | "public-demo";

export type AppRoute = {
  surface: AppSurface;
  slug?: string;
};

const previewViewRoutes: Record<string, AppRoute> = {
  site: { surface: "site" },
  tv: { surface: "tv", slug: "demo-venue" },
  mobile: { surface: "menu", slug: "demo-venue" },
  portal: { surface: "app", slug: "demo-venue" },
  logo: { surface: "logo" },
};

const publicRouteAliases: Record<string, AppRoute> = {
  trailer: { surface: "site" },
  portal: { surface: "public-demo" },
  "tv-view": { surface: "tv", slug: "public-demo" },
  "mobile-view": { surface: "menu", slug: "public-demo" },
};

const pathSurfaces = new Set<AppSurface>(["site", "trailer", "tv", "menu", "app", "venue", "sign-in", "simulator", "logo", "public-demo"]);
const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function appPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const publicViewPaths: Record<string, string> = {
    "/public-demo": "/portal",
    "/tv/public-demo": "/tv-view",
    "/menu/public-demo": "/mobile-view",
  };
  return `${appBasePath}${publicViewPaths[normalizedPath] ?? normalizedPath}` || "/";
}

export function resolveAppRoute(pathname: string, search = ""): AppRoute {
  const requestedView = new URLSearchParams(search).get("view");
  if (requestedView && previewViewRoutes[requestedView]) {
    return previewViewRoutes[requestedView];
  }

  const appPathname = appBasePath && (pathname === appBasePath || pathname.startsWith(`${appBasePath}/`))
    ? pathname.slice(appBasePath.length) || "/"
    : pathname;
  if (appBasePath && pathname === appBasePath) return { surface: "site" };
  const [surface, slug] = appPathname.split("/").filter(Boolean);
  if (!slug && surface && publicRouteAliases[surface]) {
    return publicRouteAliases[surface];
  }
  if (isPathSurface(surface)) {
    return { surface, slug };
  }

  return { surface: "site" };
}

function isPathSurface(value: string | undefined): value is AppSurface {
  return pathSurfaces.has(value as AppSurface);
}
