import { CSSProperties } from "react";
import { LucideIcon } from "lucide-react";

export interface SectionNavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  tint: string;
  count: number;
  alert?: boolean;
}

interface SectionNavProps {
  items: SectionNavItem[];
  active: string;
  onSelect: (key: string) => void;
}

export function SectionNav({ items, active, onSelect }: SectionNavProps) {
  return (
    <nav className="section-nav" aria-label="Secciones del expediente">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`section-nav-item${active === item.key ? " is-active" : ""}`}
          style={{ "--tint": item.tint } as CSSProperties}
          onClick={() => onSelect(item.key)}
        >
          <item.icon size={16} strokeWidth={2} aria-hidden="true" />
          <span>{item.label}</span>
          {item.count > 0 && <span className="section-nav-count">{item.count}</span>}
          {item.count === 0 && item.alert && <span className="section-nav-alert" aria-hidden="true" />}
        </button>
      ))}
    </nav>
  );
}
