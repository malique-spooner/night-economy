import { useEffect, useRef, useState } from "react";
import { PortalAccountPage } from "../components/portal/PortalAccountPage";
import { PortalRunsPage } from "../components/portal/PortalRunsPage";
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
import { getCurrentSession, onAuthStateChange, signOut } from "../api/auth";
import { controlSimulator, getSimulatorState, type SimulatorState } from "../api/simulator";
import { getMyAccessibleVenues, getMyPlatformAdminAccess, getVenueMemberRole, type AccessibleVenue, type VenueMemberRole } from "../api/memberships";
import { getMarketRuns, type MarketRun } from "../api/runs";
import {
  createMarketProductConfiguration,
  getMarketProductPriceHistory,
  getPosProducts,
  removeMarketProductLogo,
  updateMarketProduct,
  uploadMarketProductLogo,
  updateVenueMarketSettings,
  type MarketProductConfiguration,
  type MarketPriceHistoryPoint,
  type MarketProductPatch,
  type PosProduct,
  type VenueMarketSettingsPatch,
} from "../api/market";
import { prepareMarketProductConfiguration } from "../components/portal/portalHelpers";

type Props = {
  venueSlug: string;
};

export function Portal({ venueSlug }: Props) {
  // Realtime normally delivers changes instantly. Polling keeps the operator
  // view in sync with the POS if the browser misses a websocket event.
  const { error, refresh, setState, state } = useMarketState(venueSlug, { pollIntervalMs: 30_000 });
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAuthResolved, setIsAuthResolved] = useState(false);
  const [authError, setAuthError] = useState("");
  const [, setLastSavedMessage] = useState("");
  const [memberRole, setMemberRole] = useState<VenueMemberRole | null>(null);
  const [accessibleVenues, setAccessibleVenues] = useState<AccessibleVenue[]>([]);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasCheckedVenueAccess, setHasCheckedVenueAccess] = useState(false);
  const [activeTab, setActiveTab] = useState<PortalTab>(() => new URLSearchParams(window.location.search).get("tab") === "runs" ? "runs" : "start");
  const [isNavPinned, setIsNavPinned] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [posProducts, setPosProducts] = useState<PosProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<MarketPriceHistoryPoint[]>([]);
  const [priceHistoryLoading, setPriceHistoryLoading] = useState(false);
  const [simulatorState, setSimulatorState] = useState<SimulatorState | null>(null);
  const [runs, setRuns] = useState<MarketRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [instantRunPending, setInstantRunPending] = useState(false);
  const [isEndConfirmationOpen, setIsEndConfirmationOpen] = useState(false);
  const [tvPageWarning, setTvPageWarning] = useState<{ category: string; productId: string; patch: MarketProductPatch; options: { persist?: boolean }; productName: string } | null>(null);
  const [priorityLimitWarning, setPriorityLimitWarning] = useState<string | null>(null);
  const [scheduleOverride, setScheduleOverride] = useState<VenueMarketSettingsPatch["marketSchedule"] | null>(null);
  const scheduleChangeVersion = useRef(0);
  const runsLoadedVenueId = useRef<string | null>(null);
  const venueSettingsSaveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    void refreshSession();
    return onAuthStateChange(() => {
      void refreshSession();
    });
  }, []);

  useEffect(() => {
    if (!isAuthResolved || isSignedIn || isSigningOut) return;
    window.location.replace(`/sign-in/${encodeURIComponent(venueSlug)}`);
  }, [isAuthResolved, isSignedIn, isSigningOut, venueSlug]);

  useEffect(() => {
    if (!state) return;
    const { source, venue } = state;

    let cancelled = false;

    async function refreshVenueAccess() {
      setHasCheckedVenueAccess(false);

      if (source === "seed") {
        setMemberRole(null);
        setIsCheckingAccess(false);
        setHasCheckedVenueAccess(true);
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
        if (!cancelled) {
          setIsCheckingAccess(false);
          setHasCheckedVenueAccess(true);
        }
      }
    }

    void refreshVenueAccess();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, state?.source, state?.venue.id]);

  useEffect(() => {
    if (!isSignedIn || state?.source !== "supabase") {
      setAccessibleVenues([]);
      return;
    }

    let cancelled = false;
    void getMyAccessibleVenues()
      .then(venues => { if (!cancelled) setAccessibleVenues(venues); })
      .catch(() => { if (!cancelled) setAccessibleVenues([]); });
    return () => { cancelled = true; };
  }, [isSignedIn, state?.source]);

  useEffect(() => {
    if (!isSignedIn || !error.includes("no longer available")) return;

    let cancelled = false;
    void getMyAccessibleVenues().then(venues => {
      const destination = venues[0];
      if (!cancelled && destination) window.location.replace(`/app/${encodeURIComponent(destination.slug)}`);
    }).catch(() => {
      // The error screen remains visible when the session has no venue access.
    });
    return () => { cancelled = true; };
  }, [error, isSignedIn]);

  useEffect(() => {
    if (!state || !isSignedIn || state.source !== "supabase") return;
    let cancelled = false;
    let timer: number | undefined;
    const venueId = state.venue.id;
    const isInitialLoad = runsLoadedVenueId.current !== venueId;
    async function refreshRuns(showLoading: boolean) {
      try {
        if (showLoading) setRunsLoading(true);
        const nextRuns = await getMarketRuns(venueId);
        if (!cancelled) setRuns(nextRuns);
      } catch {
        // Keep the last successful archive visible when a background refresh
        // fails. An empty state is only meaningful on the first venue load.
        if (!cancelled && showLoading) setRuns([]);
      } finally {
        if (!cancelled) {
          if (showLoading) {
            runsLoadedVenueId.current = venueId;
            setRunsLoading(false);
          }
          // Wait until this request finishes before scheduling the next one so
          // a slow connection cannot create overlapping, out-of-order updates.
          if (activeTab === "runs") timer = window.setTimeout(() => { void refreshRuns(false); }, 5_000);
        }
      }
    }
    void refreshRuns(isInitialLoad);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [activeTab, isSignedIn, state?.source, state?.venue.id]);

  useEffect(() => {
    if (!state || state.source !== "supabase" || !isSignedIn || !hasCheckedVenueAccess || isCheckingAccess || memberRole !== null) return;

    let cancelled = false;
    void getMyAccessibleVenues().then(venues => {
      const destination = venues.find(venue => venue.slug !== venueSlug) ?? venues[0];
      if (!cancelled && destination && destination.slug !== venueSlug) {
        window.location.replace(`/app/${encodeURIComponent(destination.slug)}`);
      }
    }).catch(() => {
      // Keep the access message if the account genuinely has no venue access.
    });

    return () => { cancelled = true; };
  }, [hasCheckedVenueAccess, isCheckingAccess, isSignedIn, memberRole, state?.source, venueSlug]);

  useEffect(() => {
    let cancelled = false;

    async function refreshSimulator() {
      try {
        if (!isSignedIn) return;
        const nextState = await getSimulatorState(venueSlug);
        if (!cancelled) setSimulatorState(nextState);
      } catch {
        if (!cancelled) setSimulatorState(null);
      }
    }

    let timer: number | undefined;
    const poll = async () => {
      await refreshSimulator();
      if (!cancelled) timer = window.setTimeout(() => { void poll(); }, 10_000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isSignedIn, venueSlug]);

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
    const interval = window.setInterval(() => { void refreshPosProducts(); }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isSignedIn, state?.source, state?.venue.id]);

  if (isSigningOut) return <main className="page">Signing out...</main>;
  if (!isAuthResolved || !isSignedIn) return <main className="page">Checking secure portal access...</main>;
  if (error) return <main className="page">{error.includes("no longer available") ? "That venue has been removed. Taking you to a venue you can access…" : `Could not load portal: ${error}`}</main>;
  if (!state) return <main className="page">Loading portal...</main>;

  if (state.source === "supabase" && (!hasCheckedVenueAccess || isCheckingAccess || memberRole === null)) {
    return (
      <main className="page">
        <h1>{!hasCheckedVenueAccess || isCheckingAccess ? "Checking venue access..." : "This account cannot access this venue."}</h1>
        {hasCheckedVenueAccess && !isCheckingAccess && <button type="button" onClick={() => { void handleSignOut(); }}>Sign out and use another venue account</button>}
      </main>
    );
  }

  const liveCount = state.products.filter(product => !product.isArchived && !product.isSoldOut && product.isLive).length;
  const simulatorHref = isPlatformAdmin ? `/simulator/${encodeURIComponent(venueSlug)}` : null;
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
      ...(patch.isLive === false || patch.isArchived === true ? { isLive: false, priority: false } : {}),
    };

    if (!canPersist) {
      setLastSavedMessage(accessMessage);
      return;
    }

    if (normalizedPatch.isLive === true) {
      const nextPosProductId = normalizedPatch.posProductId ?? currentProduct.posProductId;
      const posProduct = posProducts.find(candidate => candidate.id === nextPosProductId);
      if (!posProduct || posProduct.isCurrent === false) {
        setLastSavedMessage("Connect this drink to an active POS product before making it live");
        return;
      }
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

  async function handleLogoUpload(productId: string, file: File) {
    if (!state) return;
    const previousUrl = state.products.find(product => product.id === productId)?.logoUrl;
    try {
      const uploaded = await uploadMarketProductLogo(state.venue.id, productId, file);
      await updateMarketProduct(productId, { logoUrl: uploaded.url });
      setState(current => current ? { ...current, products: applyMarketProductPatch(current.products, productId, { logoUrl: uploaded.url }) } : current);
      if (previousUrl) await removeMarketProductLogo(previousUrl);
      if (uploaded.warning) setLastSavedMessage(uploaded.warning);
    } catch (uploadError) {
      setAuthError(uploadError instanceof Error ? uploadError.message : "Could not upload logo.");
    }
  }

  async function handleLogoRemove(productId: string) {
    if (!state) return;
    const previousUrl = state.products.find(product => product.id === productId)?.logoUrl;
    if (!previousUrl) return;
    try {
      await updateMarketProduct(productId, { logoUrl: null });
      setState(current => current ? { ...current, products: applyMarketProductPatch(current.products, productId, { logoUrl: null }) } : current);
      await removeMarketProductLogo(previousUrl);
      setLastSavedMessage("Drink image removed");
    } catch (removeError) {
      setAuthError(removeError instanceof Error ? removeError.message : "Could not remove drink image.");
    }
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

    const venueId = state.venue.id;
    const scheduleVersion = patch.marketSchedule ? ++scheduleChangeVersion.current : null;
    if (patch.marketSchedule) setScheduleOverride(patch.marketSchedule);
    setState(current => current ? { ...current, venue: applyVenueSettingsPatch(current.venue, patch) } : current);

    const saveRequest = venueSettingsSaveQueue.current.then(async () => {
      await updateVenueMarketSettings(venueId, patch);
    });
    venueSettingsSaveQueue.current = saveRequest.then(() => undefined, () => undefined);
    try {
      await saveRequest;
      setState(current => current ? { ...current, venue: applyVenueSettingsPatch(current.venue, patch) } : current);
      if (scheduleVersion !== null && scheduleChangeVersion.current === scheduleVersion) setScheduleOverride(null);
      setLastSavedMessage("Launch settings saved");
    } catch (error) {
      if (scheduleVersion !== null && scheduleChangeVersion.current === scheduleVersion) setScheduleOverride(null);
      await refresh();
      setLastSavedMessage(error instanceof Error ? `Not saved: ${error.message}` : "Not saved");
    }
  }

  async function handleQuickStart() {
    try {
      // A rehearsal always compresses the six-hour service into ten minutes.
      const nextSimulatorState = await controlSimulator(venueSlug, "quick_start");
      setSimulatorState(nextSimulatorState);
      await handleVenueSettingsChange({ marketLive: true });
      setLastSavedMessage("Quick-started a 10-minute rehearsal");
    } catch (error) {
      setLastSavedMessage(error instanceof Error ? `Could not quick start: ${error.message}` : "Could not quick start the simulator");
    }
  }

  async function handleInstantRun() {
    try {
      setInstantRunPending(true);
      const nextSimulatorState = await controlSimulator(venueSlug, "instant_run");
      setSimulatorState(nextSimulatorState);
      await handleVenueSettingsChange({ marketLive: false });
      setLastSavedMessage("Instant full-night simulation completed");
      setActiveTab("runs");
    } catch (error) {
      setLastSavedMessage(error instanceof Error ? `Could not run instant simulation: ${error.message}` : "Could not run the instant simulation");
    } finally {
      setInstantRunPending(false);
    }
  }

  async function handlePause() {
    try {
      setSimulatorState(await controlSimulator(venueSlug, "pause"));
      setLastSavedMessage("Market paused and prices reset to base");
    } catch (error) {
      setLastSavedMessage(error instanceof Error ? `Could not pause: ${error.message}` : "Could not pause the simulator");
    }
  }

  async function handleResume() {
    try {
      setSimulatorState(await controlSimulator(venueSlug, "resume"));
      await handleVenueSettingsChange({ marketLive: true });
      setLastSavedMessage("Market resumed");
    } catch (error) {
      setLastSavedMessage(error instanceof Error ? `Could not resume: ${error.message}` : "Could not resume the simulator");
    }
  }

  async function handleEnd() {
    try {
      setSimulatorState(await controlSimulator(venueSlug, "end"));
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
    setIsPlatformAdmin(session ? await getMyPlatformAdminAccess() : false);
    setIsAuthResolved(true);
  }

  async function handleSignOut() {
    try {
      setAuthError("");
      setIsSigningOut(true);
      await signOut();
      window.location.assign("/");
    } catch (error) {
      setIsSigningOut(false);
      setAuthError(error instanceof Error ? error.message : "Could not sign out");
    }
  }

  return (
    <>
      <section id="portalView" className="alt-view portal-view active">
        <div className="portal-shell">
          <div className={`portal-layout ${isNavPinned ? "nav-expanded" : ""}`}>
            <PortalSidebar
              activeTab={activeTab}
              accessibleVenues={accessibleVenues}
              isPinned={isNavPinned}
              liveCount={liveCount}
              onTabChange={setActiveTab}
              onTogglePinned={() => setIsNavPinned(current => !current)}
              onSignOut={handleSignOut}
              simulatorHref={simulatorHref}
              totalCount={state.products.length}
              venueName={state.venue.name}
              venueSlug={venueSlug}
            />
            <main className="portal-main">
              <div className="portal-workspace">
                {activeTab === "start" ? (
                  <PortalStartPage
                    instantRunPending={instantRunPending}
                    onConfigurePosProduct={handleConfigurePosProduct}
                    onRestoreProduct={product => { void handleProductChange(product.id, { isArchived: false }); }}
                    onProductChange={handleProductChange}
                    onLogoUpload={handleLogoUpload}
                    onLogoRemove={handleLogoRemove}
                    onSelectProduct={handleToggleProductHistory}
                    onVenueSettingsChange={handleVenueSettingsChange}
                    onInstantRun={handleInstantRun}
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
                    venue={scheduleOverride ? { ...state.venue, marketSchedule: scheduleOverride } : state.venue}
                  />
                ) : activeTab === "runs" ? (
                  <PortalRunsPage currency={state.venue.currency} isLoading={runsLoading} products={state.products} runs={runs} timezone={state.venue.timezone} />
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
