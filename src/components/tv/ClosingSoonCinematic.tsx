type Props = { onClose: () => void };

/** Portal-only rehearsal for the closing sequence. It never changes market state. */
export function ClosingSoonCinematic({ onClose }: Props) {
  return <section aria-label="Closing soon preview" aria-modal="true" className="market-closing-cinematic" role="dialog">
    <button aria-label="Close closing soon preview" className="market-cinematic-close" onClick={onClose} type="button">Close preview</button>
    <div aria-hidden="true" className="market-closing-horizon" />
    <div aria-hidden="true" className="market-closing-orbit"><i /><i /><i /></div>
    <div className="market-closing-copy"><span>Night Economy presents</span><h1>Closing<em> soon</em></h1><p>Last orders. Final market prices are live now.</p></div>
  </section>;
}
