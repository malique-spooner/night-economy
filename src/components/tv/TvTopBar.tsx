type Props = {
  clock: string;
  isFullscreen: boolean;
  onFullscreen: () => void;
  venueName: string;
};

export function TvTopBar({ clock, isFullscreen, onFullscreen, venueName }: Props) {
  return (
    <div className="topbar">
      <div className="brand"><span>Night Economy</span><b aria-hidden="true">×</b><strong>{venueName}</strong></div>
      <div className="top-right">
        <div className="clk">{clock}</div>
        {!isFullscreen && <button aria-label="Enter full screen" className="cinema-expand tv-expand" onClick={onFullscreen} title="Enter full screen" type="button">⛶</button>}
      </div>
    </div>
  );
}
