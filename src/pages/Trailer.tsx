import { useEffect, useRef, useState } from "react";
import { appPath } from "../routes";

const story = [
  { overline: "A new rhythm for hospitality", title: <>The night<br /><em>has a pulse.</em></>, copy: "Every order moves the room. Every moment moves the market." },
  { overline: "Meet Night Economy", title: <>A live market<br /><em>for the night out.</em></>, copy: "Drink prices respond to demand, turning a menu into a shared experience." },
  { overline: "One market. Three views.", title: <>See it. Feel it.<br /><em>Step inside.</em></>, copy: "A venue portal, a live TV board and a mobile menu, connected to one changing market." },
];

export function Trailer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [chapter, setChapter] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) return;
    const timer = window.setInterval(() => setChapter(value => (value + 1) % story.length), 6200);
    return () => window.clearInterval(timer);
  }, []);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
    setPaused(video.paused);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  return (
    <main className="ne-trailer" aria-label="Night Economy introduction">
      <video aria-label="Night Economy live market preview" className="ne-trailer-video" autoPlay loop muted playsInline poster={appPath("/media/market-loop-poster.jpg")} ref={videoRef}>
        <source src={appPath("/media/market-loop.mp4")} type="video/mp4" />
      </video>
      <div className="ne-trailer-shade" />
      <header className="ne-trailer-header">
        <a className="ne-trailer-brand" href={appPath("/trailer")}><span>NIGHT ECONOMY</span><i>×</i><small>AN INTERACTIVE PRODUCT</small></a>
        <a className="ne-trailer-skip" href={appPath("/portal")}>Skip intro <span>↗</span></a>
      </header>
      <section className="ne-trailer-story" aria-live="polite" key={chapter}>
        <p>{story[chapter].overline}</p>
        <h1>{story[chapter].title}</h1>
        <div className="ne-trailer-rule"><i /></div>
        <span className="ne-trailer-copy">{story[chapter].copy}</span>
      </section>
      <footer className="ne-trailer-footer">
        <div className="ne-trailer-controls" aria-label="Trailer controls">
          <button type="button" onClick={togglePlayback} aria-label={paused ? "Play market footage" : "Pause market footage"}>{paused ? "▶" : "Ⅱ"}</button>
          <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute market footage" : "Mute market footage"}>{muted ? "SOUND OFF" : "SOUND ON"}</button>
          <span className="ne-trailer-time">00:18 <i>/</i> 00:18</span>
        </div>
        <div className="ne-trailer-cta-wrap"><small>THE NIGHT, IN A NEW LIGHT</small><a className="ne-trailer-cta" href={appPath("/portal")}>Enter Night Economy <span>→</span></a></div>
        <div className="ne-trailer-progress" aria-label={`Chapter ${chapter + 1} of 3`}>{story.map((item, index) => <button key={item.overline} type="button" aria-label={`Show chapter ${index + 1}`} aria-current={chapter === index ? "step" : undefined} onClick={() => setChapter(index)}><i /></button>)}</div>
        <p className="ne-trailer-note">Concept demo · market activity and pricing are simulated</p>
      </footer>
    </main>
  );
}
