import { useEffect } from "react";
import { Menu } from "./pages/Menu";
import { LogoDemo } from "./pages/LogoDemo";
import { Portal } from "./pages/Portal";
import { PortalSignIn } from "./pages/PortalSignIn";
import { Simulator } from "./pages/Simulator";
import { Site } from "./pages/Site";
import { Tv } from "./pages/Tv";
import { Trailer } from "./pages/Trailer";
import { resolveAppRoute } from "./routes";

export function App() {
  const route = resolveAppRoute(window.location.pathname, window.location.search);
  const isPublicMarketView = route.surface === "tv" && route.slug === "public-demo";
  const isPhoneViewport = window.matchMedia("(max-width: 760px)").matches;
  const appView = route.surface === "simulator"
    ? "simulator"
    : route.surface === "logo"
      ? "logo"
    : route.surface === "app" || route.surface === "sign-in" || route.surface === "public-demo"
      ? "portal"
    : route.surface === "menu"
      ? "mobile"
      : route.surface === "venue"
        ? "site"
        : route.surface;

  useEffect(() => {
    if (isPublicMarketView && isPhoneViewport) {
      const mobilePath = window.location.pathname.replace(/\/tv-view\/?$/, "/mobile-view").replace(/\/tv\/public-demo\/?$/, "/menu/public-demo");
      window.location.replace(`${mobilePath}${window.location.search}${window.location.hash}`);
      return;
    }

    document.body.dataset.appView = appView;
    document.documentElement.dataset.appView = appView;
    return () => {
      delete document.body.dataset.appView;
      delete document.documentElement.dataset.appView;
    };
  }, [appView, isPhoneViewport, isPublicMarketView]);

  if (isPublicMarketView && isPhoneViewport) return null;

  if (route.surface === "tv") return <Tv venueSlug={route.slug ?? "demo-venue"} />;
  if (route.surface === "trailer") return <Trailer />;
  if (route.surface === "menu") return <Menu venueSlug={route.slug ?? "demo-venue"} />;
  if (route.surface === "app") return <Portal venueSlug={route.slug ?? "demo-venue"} />;
  if (route.surface === "public-demo") return <Portal readOnly venueSlug="public-demo" />;
  if (route.surface === "sign-in") return <PortalSignIn venueSlug={route.slug} />;
  if (route.surface === "simulator") return <Simulator venueSlug={route.slug ?? "demo-venue"} />;
  if (route.surface === "logo") return <LogoDemo />;

  return <Site venueSlug={route.slug} />;
}
