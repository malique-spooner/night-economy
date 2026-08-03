import type { CSSProperties } from "react";

export type NightEconomyLogoProps = {
  /** `light` is for ivory/light surfaces; `dark` reverses the wordmark. */
  variant?: "light" | "dark";
  /** A restrained one-time reveal. Set false for the static mark. */
  animated?: boolean;
  /** Kept for backwards compatibility; the wordmark is always shown. */
  showWordmark?: boolean;
  size?: number | string;
  className?: string;
  title?: string;
};

/**
 * Deliberately text-only: it is the clearest, most durable expression of the
 * identity while a production icon is unavailable. SVG keeps it crisp and
 * gives light and reversed variants the same layout.
 */
export function NightEconomyLogo({
  variant = "light",
  animated = true,
  size = 360,
  className = "",
  title = "Night Economy",
}: NightEconomyLogoProps) {
  const style = { width: size } as CSSProperties;

  return (
    <svg
      aria-label={title}
      className={`night-economy-logo night-economy-logo--${variant} ${animated ? "is-animated" : "is-static"} ${className}`}
      role="img"
      style={style}
      viewBox="0 0 500 82"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <text className="ne-text-wordmark" x="0" y="59">NIGHT ECONOMY</text>
    </svg>
  );
}
