import { formatInputMoney } from "./portalHelpers";

type Props = {
  label: string;
  onChange: (valueMinor: number, options?: { persist?: boolean }) => void;
  readOnly?: boolean;
  valueMinor: number;
};

const stepMinor = 50;

export function PortalMoneyField({ label, onChange, readOnly = false, valueMinor }: Props) {
  return (
    <label className="portal-money-field">
      <span>{label}</span>
      <div>
        <button aria-label={`Decrease ${label}`} disabled={readOnly} type="button" onClick={() => onChange(Math.max(0, valueMinor - stepMinor))}>−</button>
        <input
          disabled={readOnly}
          type="number"
          step="0.01"
          value={formatInputMoney(valueMinor)}
          onChange={event => onChange(Math.round(Number(event.target.value || 0) * 100), { persist: false })}
          onBlur={event => onChange(Math.round(Number(event.target.value || 0) * 100))}
        />
        <button aria-label={`Increase ${label}`} disabled={readOnly} type="button" onClick={() => onChange(valueMinor + stepMinor)}>+</button>
      </div>
    </label>
  );
}
