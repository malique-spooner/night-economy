import { useLayoutEffect, useState } from "react";

const steps = [
  { target: "service-controls", title: "Run the 18-minute demo", body: "Press Start 18-min demo to run a safe Showcase demonstration using sample data." },
  { target: "market", title: "See the TV view", body: "Market opens the guest-facing screen your venue would show on its display." },
  { target: "mobile", title: "See the phone view", body: "Mobile market opens the guest-facing menu for customers’ phones." },
  { target: "runs", title: "Review what happened", body: "Run history keeps the results from previous services." },
];

export function PortalTour({ isServiceOpen, onClose }: { isServiceOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [position, setPosition] = useState({ top: 96, left: 20, side: "left" as "left" | "right" });
  const current = steps[step];
  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-portal-tour='${current.target}']`) ?? document.querySelector<HTMLElement>("[data-portal-tour='start']");
    const place = () => {
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const mobile = window.innerWidth <= 820;
      if (mobile) {
        setPosition({ top: Math.min(rect.bottom + 12, window.innerHeight - 260), left: 12, side: "left" });
        return;
      }
      const tipWidth = 340;
      const gap = 16;
      const hasRoomOnRight = rect.right + gap + tipWidth <= window.innerWidth - 16;
      setPosition({
        top: Math.min(Math.max(20, rect.top), window.innerHeight - 260),
        left: hasRoomOnRight ? rect.right + gap : Math.max(16, rect.left - tipWidth - gap),
        side: hasRoomOnRight ? "left" : "right",
      });
    };
    const sidebar = target?.closest(".portal-sidebar");
    const observer = new ResizeObserver(place);
    if (target) observer.observe(target);
    sidebar?.addEventListener("transitionend", place);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    requestAnimationFrame(place);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { observer?.disconnect(); sidebar?.removeEventListener("transitionend", place); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [current.target]);
  const { side, ...style } = position;
  return <section className={`portal-tour portal-tour-${side}`} role="dialog" aria-modal="true" aria-labelledby="portal-tour-title" style={style}>
    <span>{step + 1} / {steps.length}</span><h2 id="portal-tour-title">{step === 0 && isServiceOpen ? "Demo already running" : current.title}</h2><p>{step === 0 && isServiceOpen ? "The demo is already running. Use Pause, Resume or End right here to control it." : current.body}</p>
    <div><button disabled={step === 0} onClick={() => setStep(value => value - 1)} type="button">Back</button>{step === steps.length - 1 ? <button onClick={onClose} type="button">Done</button> : <button onClick={() => setStep(value => value + 1)} type="button">Next</button>}</div>
  </section>;
}
