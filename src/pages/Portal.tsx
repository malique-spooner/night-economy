import { useEffect, useState } from "react";
import { PortalAccountPage } from "../components/portal/PortalAccountPage";
import { PortalAuthPanel } from "../components/portal/PortalAuthPanel";
import { PortalSidebar, type PortalTab } from "../components/portal/PortalSidebar";
import { PortalStartPage } from "../components/portal/PortalStartPage";
import {
  applyMarketProductPatch,
  applyVenueSettingsPatch,
  canEditMarketProducts,
  canManageVenueSettings,
  normalizeMarketProductPatch,
  portalAccessMessage,
  venueSettingsAccessMessage,
  wouldExceedPriorityLimit,
  wouldNeedAnotherTvPage,
} from "../components/portal/portalHelpers";
import { useMarketState } from "../hooks/useMarketState";
import { supabaseStatus } from "../api/client";
import { getCurrentSession, onAuthStateChange, signInWithEmail, signOut } from "../api/auth";
import { controlSimulator, getSimulatorState, type SimulatorState } from "../api/simulator";
import { getVenueMemberRole, type VenueMemberRole } from "../api/memberships";
import {
  createMarketProductConfiguration,
  getMarketProductPriceHistory,
  getPosProducts,
  updateMarketProduct,
  updateVenueMarketSettings,
  type MarketProductConfiguration,
  type MarketPriceHistoryPoint,
  type MarketProductPatch,
  type PosProduct,
  type VenueMarketSettingsPatch,
} from "../api/market";
import { prepareMarketProductConfiguration } from "../components/portal/portalHelpers";
import { PageSwitcher } from "./PageSwitcher";

type Props = {
  venueSlug: string;
};

export function Portal({ venueSlug }: Props) {
  // Realtime normally delivers changes instantly. Polling keeps the operator
  // view in sync with the POS if the browser misses a websocket event.
  const { error, setState, state } = useMarketState(venueSlug, { pollIntervalMs: 2_000 });
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [, setLastSavedMessage] = useState("");
  const [memberRole, setMemberRole] = useState<VenueMemberRole | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [activeTab, setActiveTab] = useState<PortalTab>("start");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [posProducts, setPosProducts] = useState<PosProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<MarketPriceHistoryPoint[]>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [simulatorState, setSimulatorState] = useState<SimulatorState | null>(null);
  const [isEndConfirmationOpen, setIsEndConfirmationOpen] = useState(false);
  const [tvPageWarning, setTvPageWarning] = useState<{ category: string; productId: string; patch: MarketProductPatch; options: { persist?: boolean }; productName: string } | null>(null);
  const [priorityLimitWarning, setPriorityLimitWarning] = useState<string | null>(null);

  useEffect(() => {
    void refreshSession();
    return onAuthStateChange(() => {
      void refreshSession();
    });
  }, []);

  useEffect(() => {
    if (!state) return;
    const { source, venue } = state;

    let cancelled = false;

    async function refreshVenueAccess() {
      if (source === "seed") {
        setMemberRole(null);
        setIsCheckingAccess(false);
        return;
      }

      if (!isSignedIn) {
        setMemberRole(null);
        setIsCheckingAccess(false);
        return;
      }

      try {
        setIsCheckingAccess(true);
        const role = await getVenueMemberRole(venue.id);
        if (!cancelled) setMemberRole(role);
      } catch (error) {
        if (!cancelled) {
          setMemberRole(null);
          setAuthError(error instanceof Error ? error.message : "Could not check venue access");
        }
      } finally {
        if (!cancelled) setIsCheckingAccess(false);
      }
    }

    void refreshVenueAccess();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, state?.source, state?.venue.id]);

  useEffect(() => {
    let cancelled = false;

    async function refreshSimulator() {
      try {
        const nextState = await getSimulatorState();
        if (!cancelled) setSimulatorState(nextState);
      } catch {
        if (!cancelled) setSimulatorState(null);
      }
    }

    void refreshSimulator();
    const interval = window.setInterval(() => { void refreshSimulator(); }, 1_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!state || !selectedProductId || state.source === "seed") {
      setPriceHistory([]);
      setPriceHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setPriceHistoryLoading(true);
    void getMarketProductPriceHistory(state.venue.id, selectedProductId)
      .then(history => {
        if (!cancelled) setPriceHistory(history);
      })
      .catch(error => {
        if (!cancelled) {
          setPriceHistory([]);
          setLastSavedMessage(error instanceof Error ? error.message : "Could not load price history");
        }
      })
      .finally(() => {
        if (!cancelled) setPriceHistoryLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedProductId, state?.source, state?.venue.id]);

  useEffect(() => {
    if (!state) return;
    const marketState = state;
    let cancelled = false;
    async function refreshPosProducts() {
      if (marketState.source === "supabase" && !isSignedIn) {
        setPosProducts([]);
        return;
      }
      try {
        const nextProducts = await getPosProducts(marketState.venue.id);
        if (!cancelled) setPosProducts(nextProducts);
      } catch (error) {
        if (!cancelled) setLastSavedMessage(error instanceof Error ? `Could not load POS products: ${error.message}` : "Could not load POS products");
      }
    }
    void refreshPosProducts();
    return () => { cancelled = true; };
  }, [isSignedIn, state?.source, state?.venue.id]);

  if (error) return <main className="page">Could not load portal: {error}</main>;
  if (!state) return <main className="page">Loading portal...</main>;

  const liveCount = state.products.filter(product => !product.isSoldOut && product.isLive).length;
  const canPersist = canEditMarketProducts({ isSignedIn, role: memberRole, source: state.source });
  const canManageSettings = canManageVenueSettings({ role: memberRole, source: state.source });
  const accessMessage = portalAccessMessage({
    isCheckingAccess,
    isSignedIn,
    role: memberRole,
    source: state.source,
  });
  const settingsAccessMessage = venueSettingsAccessMessage({ role: memberRole, source: state.source });

  async function handleProductChange(
    productId: string,
    patch: MarketProductPatch,
    options: { persist?: boolean } = {},
    skipTvPageWarning = false,
  ) {
    if (!state) return;
    const currentProduct = state.products.find(product => product.id === productId);
    if (!currentProduct) return;
    const normalizedPatch = {
      ...normalizeMarketProductPatch(currentProduct, patch),
      ...(patch.isLive === false ? { priority: false } : {}),
    };

    if (!canPersist) {
      setLastSavedMessage(accessMessage);
      return;
    }

    if (wouldExceedPriorityLimit(state.products, currentProduct, normalizedPatch)) {
      setPriorityLimitWarning(normalizedPatch.category ?? currentProduct.category);
      return;
    }

    if (!skipTvPageWarning && wouldNeedAnotherTvPage(state.products, currentProduct, normalizedPatch)) {
      setTvPageWarning({ category: normalizedPatch.category ?? currentProduct.category, productId, patch: normalizedPatch, options, productName: currentProduct.name });
      return;
    }

    setState({
      ...state,
      products: applyMarketProductPatch(state.products, productId, normalizedPatch),
    });

    if (options.persist === false) {
      setLastSavedMessage("Unsaved edit");
      return;
    }

    try {
      const result = await updateMarketProduct(productId, normalizedPatch);
      setLastSavedMessage(result.persisted ? "Saved to Supabase" : "Demo change only");
    } catch (error) {
      setState(current =>
        current
          ? {
              ...current,
              products: applyMarketProductPatch(current.products, productId, currentProduct),
            }
          : current,
      );
      setLastSavedMessage(error instanceof Error ? `Not saved: ${error.message}` : "Not saved");
    }
  }

  function handleToggleProductHistory(productId: string) {
    setSelectedProductId(currentProductId => currentProductId === productId ? null : productId);
  }

  async function handleConfigurePosProduct(posProduct: PosProduct) {
    if (!state) return false;

    if (!canPersist) {
      setLastSavedMessage(accessMessage);
      return false;
    }

    try {
      const product: MarketProductConfiguration = prepareMarketProductConfiguration({
        id: `mp_${crypto.randomUUID()}`,
        posProduct,
        products: state.products,
      });
      const result = await createMarketProductConfiguration(state.venue.id, product);
      setState({ ...state, products: [...state.products, result.product] });
      setLastSavedMessage(result.persisted ? "POS product configured for the market" : "Demo product configured for the market");
      return true;
    } catch (error) {
      setLastSavedMessage(error instanceof Error ? `Not configured: ${error.message}` : "Not configured");
      return false;
    }
  }

  async function handleVenueSettingsChange(patch: VenueMarketSettingsPatch) {
    if (!state) return;

    if (!canManageSettings) {
      setLastSavedMessage(settingsAccessMessage);
      return;
    }

    const previousVenue = state.venue;
    const nextVenue = applyVenueSettingsPatch(state.venue, patch);
    setState({ ...state, venue: nextVenue });


    try {
      const result = await updateVenueMarketSettings(state.venue.id, patch);
      setLastSavedMessage(result.persisted ? "Launch settings saved" : "Demo launch settings");
    } catch (error) {
      setState(current => (current ? { ...current, venue: previousVenue } : current));
      setLastSavedMessage(error instanceof Error ? `Not saved: ${error.message}` : "Not saved");
    }
  }

  async function handleQuickStart() {
    try {
      // The simulator owns pace and target takings. Quick start only rewinds it
      // to 18:00, preserves those controls, and starts the service.
      const nextSimulatorState = await controlSimulator("quick_start");
      setSimulatorState(nextSimulatorState);
      await handleVenueSettingsChange({ marketLive: true });
      setLastSavedMessage("Quick-started Friday service at 18:00");
    } catch (error) {
      setLastSavedMessage(error instanceof Error ? `Could not quick start: ${error.message}` : "Could not quick start the simulator");
    }
  }

  async function handlePause() {
    try {
      setSimulatorState(await controlSimulator("pause"));
      setLastSavedMessage("Market paused and prices reset to base");
    } catch (error) {
      setLastSavedMessage(error instanceof Error ? `Could not pause: ${error.message}` : "Could not pause the simulator");
    }
  }

  async function handleResume() {
    try {
      setSimulatorState(await controlSimulator("resume"));
      await handleVenueSettingsChange({ marketLive: true });
      setLastSavedMessage("Market resumed");
    } catch (error) {
      setLastSavedMessage(error instanceof Error ? `Could not resume: ${error.message}` : "Could not resume the simulator");
    }
  }

  async function handleEnd() {
    try {
      setSimulatorState(await controlSimulator("end"));
      await handleVenueSettingsChange({ marketLive: false });
      setLastSavedMessage("Market ended and prices reset to base");
    } catch (error) {
      setLastSavedMessage(error instanceof Error ? `Could not end: ${error.message}` : "Could not end the simulator");
    } finally {
      setIsEndConfirmationOpen(false);
    }
  }

  async function refreshSession() {
    const session = await getCurrentSession();
    setIsSignedIn(Boolean(session));
    setSignedInEmail(session?.user.email ?? "");
  }

  async function handleSignIn() {
    try {
      setAuthError("");
      await signInWithEmail(email, password);
      setPassword("");
      await refreshSession();
      setLastSavedMessage("Checking venue access");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign in");
    }
  }

  async function handleSignOut() {
    try {
      setAuthError("");
      await signOut();
      await refreshSession();
      setMemberRole(null);
      setLastSavedMessage("Signed out");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign out");
    }
  }

  return (
    <>
      <PageSwitcher active="portal" venueSlug={venueSlug} />
      <section id="portalView" className="alt-view portal-view active">
        <div className="portal-shell">
          <div className="portal-layout">
            <PortalSidebar
              activeTab={activeTab}
              authSlot={
                <PortalAuthPanel
                  email={email}
                  error={authError}
                  isConfigured={supabaseStatus.ready}
                  isSignedIn={isSignedIn}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onSignIn={handleSignIn}
                  onSignOut={handleSignOut}
                  password={password}
                  statusMessage={accessMessage}
                />
              }
              liveCount={liveCount}
              onTabChange={setActiveTab}
              onSignOut={handleSignOut}
              totalCount={state.products.length}
            />
            <main className="portal-main">
              <div className="portal-workspace">
                {activeTab === "start" ? (
                  <PortalStartPage
                    onConfigurePosProduct={handleConfigurePosProduct}
                    onProductChange={handleProductChange}
                    onSelectProduct={handleToggleProductHistory}
                    onVenueSettingsChange={handleVenueSettingsChange}
                    onQuickStart={handleQuickStart}
                    onPause={handlePause}
                    onResume={handleResume}
                    onEnd={() => setIsEndConfirmationOpen(true)}
                    products={state.products}
                    priceHistory={priceHistory}
                    priceHistoryLoading={priceHistoryLoading}
                    posProducts={posProducts}
                    selectedProductId={selectedProductId}
                    simulatorState={simulatorState}
                    venue={state.venue}
                  />
                ) : (
                  <PortalAccountPage
                    email={signedInEmail}
                    isSignedIn={isSignedIn}
                    liveCount={liveCount}
                    role={memberRole}
                    source={state.source}
                    totalCount={state.products.length}
                    venue={state.venue}
                  />
                )}
                {isEndConfirmationOpen ? <div className="portal-confirm-backdrop" role="presentation">
                  <section aria-labelledby="end-market-title" aria-modal="true" className="portal-confirm-dialog" role="dialog">
                    <span className="portal-start-kicker">End market</span>
                    <h2 id="end-market-title">End this service early?</h2>
                    <p>Sales will stop and every market price will return to its base price.</p>
                    <div>
                      <button onClick={() => setIsEndConfirmationOpen(false)} type="button">Keep service running</button>
                      <button className="portal-confirm-end" onClick={handleEnd} type="button">End service</button>
                    </div>
                  </section>
                </div> : null}
                {tvPageWarning ? <div className="portal-confirm-backdrop" role="presentation">
                  <section aria-labelledby="tv-page-warning-title" aria-modal="true" className="portal-confirm-dialog" role="dialog">
                    <span className="portal-start-kicker">TV display</span>
                    <h2 id="tv-page-warning-title">Add another {tvPageWarning.category} TV page?</h2>
                    <p>Making {tvPageWarning.productName} live puts more than 13 drinks in {tvPageWarning.category}. The TV will rotate through multiple {tvPageWarning.category} pages and label them, for example “{tvPageWarning.category} · 1 / 2”.</p>
                    <div>
                      <button onClick={() => setTvPageWarning(null)} type="button">Keep one page</button>
                      <button className="portal-confirm-end" onClick={() => {
                        const pending = tvPageWarning;
                        setTvPageWarning(null);
                        void handleProductChange(pending.productId, pending.patch, pending.options, true);
                      }} type="button">Add drink</button>
                    </div>
                  </section>
                </div> : null}
                {priorityLimitWarning ? <div className="portal-confirm-backdrop" role="presentation">
                  <section aria-labelledby="priority-limit-warning-title" aria-modal="true" className="portal-confirm-dialog" role="dialog">
                    <span className="portal-start-kicker">TV priorities</span>
                    <h2 id="priority-limit-warning-title">Three priority drinks per category</h2>
                    <p>{priorityLimitWarning} already has three priority drinks. Turn one off before choosing another TV feature.</p>
                    <div><button className="portal-confirm-end" onClick={() => setPriorityLimitWarning(null)} type="button">Okay</button></div>
                  </section>
                </div> : null}
              </div>
            </main>
          </div>
        </div>
      </section>
    </>
  );
}
