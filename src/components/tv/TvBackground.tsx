export function TvBackground() {
  return (
    <div className="app-bg">
      <div className="tv-pixel-field" aria-hidden="true">
        {Array.from({ length: 44 }, (_, index) => {
          const size = 3 + (index % 4) * 2;
          return <i key={index} style={{ height: size, left: `${(index * 29) % 100}%`, top: `${(index * 47) % 100}%`, width: size }} />;
        })}
      </div>
      <div className="grid"></div>
      <div className="wash"></div>
      <div className="vignette"></div>
      <div className="scanlines"></div>
    </div>
  );
}
