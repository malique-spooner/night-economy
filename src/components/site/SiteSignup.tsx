import { useState, type FormEvent } from "react";
import { defaultSitePlanId, siteBuyingAnswers } from "../../content/siteContent";
import { prepareSiteLead } from "../../api/leadForm";
import { createSiteLead, type SiteLeadPlan } from "../../api/leads";

const initialForm = {
  venueName: "",
  ownerName: "",
  email: "",
};

export function SiteSignup() {
  const [form, setForm] = useState(initialForm);
  const selectedPlan: SiteLeadPlan = defaultSitePlanId;
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const preparedLead = prepareSiteLead({ ...form, plan: selectedPlan });
    if (!preparedLead.ok) {
      setStatus("error");
      setMessage(preparedLead.message);
      return;
    }

    try {
      setStatus("submitting");
      const result = await createSiteLead(preparedLead.payload);

      setStatus("success");
      setMessage(
        result.persisted
          ? "Request received. We will help you set up the venue."
          : "Request ready locally. Connect Supabase to save live leads.",
      );
      setForm(initialForm);
    } catch {
      setStatus("error");
      setMessage("We could not save that request. Please try again.");
    }
  }

  return (
    <section id="site-subscribe" className="site-section site-subscribe">
      <div className="site-subscribe-copy">
        <div className="site-kicker">Start with proof</div>
        <h2>Prove it in one venue.</h2>
        <p>Use a short discovery call to define the service, integration path, guardrails, and measurement plan.</p>
        <ul className="site-pilot-includes">
          <li><span>01</span>Baseline and success measures</li>
          <li><span>02</span>Menu and integration discovery</li>
          <li><span>03</span>Operator training and launch support</li>
          <li><span>04</span>Post-service performance review</li>
        </ul>
      </div>
      <div className="site-signup-panel">
        <div className="site-signup-head">
          <div><span>15-minute discovery</span><strong>Tell us where to start.</strong></div>
          <p>No payment details. We will scope the pilot before proposing a price.</p>
        </div>
        <form className="site-signup-form" onSubmit={handleSubmit}>
          <label>
            <span>Venue name</span>
            <input
              type="text"
              placeholder="Pickle House Shoreditch"
              value={form.venueName}
              onChange={event => setForm(current => ({ ...current, venueName: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Your name</span>
            <input
              type="text"
              placeholder="Alex Morgan"
              value={form.ownerName}
              onChange={event => setForm(current => ({ ...current, ownerName: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              placeholder="owner@venue.com"
              value={form.email}
              onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
              required
            />
          </label>
          {message ? (
            <p className={`site-signup-message ${status === "error" ? "error" : ""}`} aria-live="polite">
              {message}
            </p>
          ) : null}
          <button className="site-primary" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Sending request…" : "Book the discovery call"}
          </button>
          <small className="site-form-privacy">We only use these details to respond about Night Economy. No mailing list.</small>
        </form>
        <div className="site-buying-answers">
          <div className="site-kicker">Before you ask</div>
          {siteBuyingAnswers.map(item => (
            <details key={item.question}>
              <summary>{item.question}<span aria-hidden="true">+</span></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
