import { useEffect } from "react";
import { Menu } from "./pages/Menu";
import { LogoDemo } from "./pages/LogoDemo";
import { Portal } from "./pages/Portal";
import { PortalSignIn } from "./pages/PortalSignIn";
import { Simulator } from "./pages/Simulator";
import { Site } from "./pages/Site";
import { Tv } from "./pages/Tv";
import { resolveAppRoute } from "./routes";

export function App() {
  const route = resolveAppRoute(window.location.pathname, window.location.search);
  const appView = route.surface === "simulator"
    ? "simulator"
    : route.surface === "logo"
      ? "logo"
    : route.surface === "app" || route.surface === "sign-in"
      ? "portal"
    : route.surface === "menu"
      ? "mobile"
      : route.surface === "venue"
        ? "site"
        : route.surface;

  useEffect(() => {
    document.body.dataset.appView = appView;
    document.documentElement.dataset.appView = appView;
    return () => {
      delete document.body.dataset.appView;
      delete document.documentElement.dataset.appView;
    };
  }, [appView]);

  if (route.surface === "tv") return <Tv venueSlug={route.slug ?? "demo-venue"} />;
  if (route.surface === "menu") return <Menu venueSlug={route.slug ?? "demo-venue"} />;
  if (route.surface === "app") return <Portal venueSlug={route.slug ?? "demo-venue"} />;
  if (route.surface === "sign-in") return <PortalSignIn venueSlug={route.slug} />;
  if (route.surface === "simulator") return <Simulator venueSlug={route.slug ?? "demo-venue"} />;
  if (route.surface === "logo") return <LogoDemo />;

  return <Site venueSlug={route.slug} />;
}
