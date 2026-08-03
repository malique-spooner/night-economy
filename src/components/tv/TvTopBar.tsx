type Props = {
  clock: string;
  marketStatusLabel: string;
  sourceLabel: string;
  onFullscreen: () => void;
  venueName: string;
};

export function TvTopBar({ clock, marketStatusLabel, sourceLabel, onFullscreen, venueName }: Props) {
  return (
    <div className="topbar">
      <div className="brand"><span>Night Economy</span><b aria-hidden="true">×</b><strong>{venueName}</strong></div>
      <div className="live-pill">
        <div className="live-dot"></div>
        <span>{marketStatusLabel}</span>
      </div>
      <div className="top-right">
        <div className="trade-count">{sourceLabel}</div>
        <div className="clk">{clock}</div>
        <button aria-label="Enter full screen" className="cinema-expand tv-expand" onClick={onFullscreen} title="Enter full screen" type="button">⛶</button>
      </div>
    </div>
  );
}
