type AppSurface = "site" | "tv" | "menu" | "app" | "venue" | "sign-in" | "simulator" | "logo" | "public-demo";

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

const pathSurfaces = new Set<AppSurface>(["site", "tv", "menu", "app", "venue", "sign-in", "simulator", "logo", "public-demo"]);
const appBasePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function appPath(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${appBasePath}${normalizedPath}` || "/";
}

export function resolveAppRoute(pathname: string, search = ""): AppRoute {
  const requestedView = new URLSearchParams(search).get("view");
  if (requestedView && previewViewRoutes[requestedView]) {
    return previewViewRoutes[requestedView];
  }

  const appPathname = appBasePath && (pathname === appBasePath || pathname.startsWith(`${appBasePath}/`))
    ? pathname.slice(appBasePath.length) || "/"
    : pathname;
  const [surface, slug] = appPathname.split("/").filter(Boolean);
  if (isPathSurface(surface)) {
    return { surface, slug };
  }

  return { surface: "site" };
}

function isPathSurface(value: string | undefined): value is AppSurface {
  return pathSurfaces.has(value as AppSurface);
}
