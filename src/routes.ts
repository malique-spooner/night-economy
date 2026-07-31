type AppSurface = "site" | "tv" | "menu" | "app" | "venue" | "sign-in" | "simulator";

export type AppRoute = {
  surface: AppSurface;
  slug?: string;
};

const previewViewRoutes: Record<string, AppRoute> = {
  site: { surface: "site" },
  tv: { surface: "tv", slug: "demo-venue" },
  mobile: { surface: "menu", slug: "demo-venue" },
  portal: { surface: "app", slug: "demo-venue" },
};

const pathSurfaces = new Set<AppSurface>(["site", "tv", "menu", "app", "venue", "sign-in", "simulator"]);

export function resolveAppRoute(pathname: string, search = ""): AppRoute {
  const requestedView = new URLSearchParams(search).get("view");
  if (requestedView && previewViewRoutes[requestedView]) {
    return previewViewRoutes[requestedView];
  }

  const [surface, slug] = pathname.split("/").filter(Boolean);
  if (isPathSurface(surface)) {
    return { surface, slug };
  }

  return { surface: "site" };
}

function isPathSurface(value: string | undefined): value is AppSurface {
  return pathSurfaces.has(value as AppSurface);
}
