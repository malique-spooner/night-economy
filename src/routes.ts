type AppSurface = "site" | "tv" | "menu" | "app" | "venue" | "sign-in" | "simulator" | "logo" | "public-demo";

export type AppRoute = {
  surface: AppSurface;
  slug?: string;
};

export function appPath(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}` || "/";
}

const previewViewRoutes: Record<string, AppRoute> = {
  site: { surface: "site" },
  tv: { surface: "tv", slug: "demo-venue" },
  mobile: { surface: "menu", slug: "demo-venue" },
  portal: { surface: "app", slug: "demo-venue" },
  logo: { surface: "logo" },
};

const pathSurfaces = new Set<AppSurface>(["site", "tv", "menu", "app", "venue", "sign-in", "simulator", "logo", "public-demo"]);

export function resolveAppRoute(pathname: string, search = ""): AppRoute {
  const requestedView = new URLSearchParams(search).get("view");
  if (requestedView && previewViewRoutes[requestedView]) {
    return previewViewRoutes[requestedView];
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "night") segments.shift();
  const [surface, slug] = segments;
  if (isPathSurface(surface)) {
    return { surface, slug };
  }

  return { surface: "site" };
}

function isPathSurface(value: string | undefined): value is AppSurface {
  return pathSurfaces.has(value as AppSurface);
}
