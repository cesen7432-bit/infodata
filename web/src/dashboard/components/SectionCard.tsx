import { CSSProperties, ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  tint: string;
  statusPill?: ReactNode;
  isEmpty?: boolean;
  emptyLabel?: string;
  children: ReactNode;
}

export function SectionCard({ title, subtitle, icon: Icon, tint, statusPill, isEmpty, emptyLabel, children }: SectionCardProps) {
  return (
    <section className="section-card" style={{ "--tint": tint } as CSSProperties}>
      <header className="section-card-head">
        <div className="section-card-title">
          <span className="section-icon" style={{ background: `${tint}22`, color: tint }}>
            <Icon size={18} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="section-card-sub">{subtitle}</p>}
          </div>
        </div>
        {statusPill}
      </header>
      <div className="section-card-body">
        {isEmpty ? <p className="section-empty">{emptyLabel ?? "Sin datos de esta fuente."}</p> : children}
      </div>
    </section>
  );
}
