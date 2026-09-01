import { type FormEvent, useEffect, useState } from "react";
import { getCurrentSession, onAuthStateChange, sendPasswordReset, signInWithEmail, signOut, updatePassword } from "../api/auth";
import { supabaseStatus } from "../api/client";
import { getMyAccessibleVenues } from "../api/memberships";

type Props = {
  venueSlug?: string;
};

export function PortalSignIn({ venueSlug }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(() => window.location.hash.includes("type=recovery"));
  const [status, setStatus] = useState<"idle" | "signing-in" | "resetting" | "updating">("idle");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [hasNoVenueAccess, setHasNoVenueAccess] = useState(false);
  const requestedTab = new URLSearchParams(window.location.search).get("next");
  const requestedVenueSlug = venueSlug?.trim() || undefined;
  const destinationFor = (slug: string) => `/app/${encodeURIComponent(slug)}${requestedTab === "runs" ? "?tab=runs" : ""}`;

  useEffect(() => {
    async function continueIfSignedIn() {
      if (isRecovery || !await getCurrentSession()) return;
      const accessibleVenues = await getMyAccessibleVenues();
      const destination = accessibleVenues.find(venue => venue.slug === requestedVenueSlug) ?? accessibleVenues[0];
      if (destination) window.location.replace(destinationFor(destination.slug));
    }

    void continueIfSignedIn();
    return onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        return;
      }
      void continueIfSignedIn();
    });
  }, [isRecovery, requestedVenueSlug, requestedTab]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      setMessage("");
      setIsError(false);
      setHasNoVenueAccess(false);
      setStatus("signing-in");
      await signInWithEmail(email, password);
      const accessibleVenues = await getMyAccessibleVenues();
      const destination = accessibleVenues.find(venue => venue.slug === requestedVenueSlug) ?? accessibleVenues[0];
      if (!destination) throw new Error("This account does not have access to a Night Economy venue.");
      const destinationHref = destinationFor(destination.slug);
      window.location.assign(destinationHref);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Could not sign in. Check your details and try again.";
      setIsError(true);
      setMessage(nextMessage);
      setHasNoVenueAccess(nextMessage === "This account does not have access to a Night Economy venue.");
      setStatus("idle");
    }
  }

  async function handlePasswordReset() {
    if (!email.trim()) {
      setIsError(true);
      setMessage("Enter your work email first, then request a reset link.");
      return;
    }

    try {
      setIsError(false);
      setMessage("");
      setStatus("resetting");
      const resetPath = requestedVenueSlug ? `/sign-in/${encodeURIComponent(requestedVenueSlug)}` : "/sign-in";
      await sendPasswordReset(email, `${window.location.origin}${resetPath}`);
      setMessage("Password reset link sent. Check your inbox.");
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "We could not send a reset link. Please try again.");
    } finally {
      setStatus("idle");
    }
  }

  async function handlePasswordUpdate(event: FormEvent) {
    event.preventDefault();
    if (password.length < 12) {
      setIsError(true);
      setMessage("Use at least 12 characters for the new password.");
      return;
    }
    if (password !== confirmPassword) {
      setIsError(true);
      setMessage("The passwords do not match.");
      return;
    }
    try {
      setStatus("updating");
      setIsError(false);
      setMessage("");
      await updatePassword(password);
      const accessibleVenues = await getMyAccessibleVenues();
      const destination = accessibleVenues.find(venue => venue.slug === requestedVenueSlug) ?? accessibleVenues[0];
      if (!destination) throw new Error("This account does not have access to a Night Economy venue.");
      window.location.replace(destinationFor(destination.slug));
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "We could not update the password. Request a new reset link.");
      setStatus("idle");
    }
  }

  return (
    <main className="portal-signin-page">
      <section className="portal-signin-card" aria-labelledby="portal-signin-title">
        <a className="portal-signin-back" href={requestedVenueSlug ? `/venue/${encodeURIComponent(requestedVenueSlug)}` : "/"}>← Back</a>
        <p className="portal-signin-kicker">Night Economy</p>
        <h1 id="portal-signin-title">{isRecovery ? "New password" : "Sign in"}</h1>
        {isRecovery ? (
          <form className="portal-signin-form" onSubmit={handlePasswordUpdate}>
            <label>
              <span>New password</span>
              <input autoComplete="new-password" disabled={status !== "idle"} minLength={12} onChange={event => setPassword(event.target.value)} required type="password" value={password} />
            </label>
            <label>
              <span>Confirm password</span>
              <input autoComplete="new-password" disabled={status !== "idle"} minLength={12} onChange={event => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
            </label>
            <button disabled={status !== "idle"} type="submit">{status === "updating" ? "Updating password…" : "Update password"}</button>
          </form>
        ) : (
        <form className="portal-signin-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input autoComplete="email" disabled={!supabaseStatus.ready} onChange={event => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label>
            <span>Password</span>
            <div className="portal-password-field">
              <input aria-label="Password" autoComplete="current-password" disabled={!supabaseStatus.ready || status !== "idle"} onChange={event => setPassword(event.target.value)} required type={showPassword ? "text" : "password"} value={password} />
              <button type="button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
            </div>
          </label>
          <div className="portal-signin-help">
            <button type="button" onClick={handlePasswordReset} disabled={!supabaseStatus.ready || status !== "idle"}>Forgot password?</button>
          </div>
          <button disabled={!supabaseStatus.ready || status !== "idle"} type="submit">{status === "signing-in" ? "Signing in…" : "Sign in securely"}</button>
        </form>
        )}
        {(message || !supabaseStatus.ready) && <p className={`portal-signin-status ${isError ? "error" : ""}`} aria-live="polite">{message || "Sign-in is not configured yet."}</p>}
        {!isRecovery && <a className="portal-public-demo-link" href="/public-demo">Try the public demo <span aria-hidden="true">→</span></a>}
        {hasNoVenueAccess && <button className="portal-signin-signout" type="button" onClick={() => { void signOut().finally(() => window.location.assign("/sign-in")); }}>Sign out and use another venue account</button>}
        <div className="portal-signin-footer"><a href="mailto:hello@nighteconomy.app?subject=Portal%20access">Contact support</a></div>
      </section>
    </main>
  );
}
