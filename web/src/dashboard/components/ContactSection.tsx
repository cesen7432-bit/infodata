import { Phone as PhoneIcon } from "lucide-react";
import { Address, Email, Phone } from "../../api/types";
import { SectionCard } from "./SectionCard";
import { formatRelativeTime } from "../format";

interface ContactSectionProps {
  addresses: Address[];
  phones: Phone[];
  emails: Email[];
}

function isMeaningful(value: string | null | undefined): value is string {
  if (!value) return false;
  return !/^sin\s+dato/i.test(value.trim());
}

export function ContactSection({ addresses, phones, emails }: ContactSectionProps) {
  const isEmpty = addresses.length === 0 && phones.length === 0 && emails.length === 0;

  return (
    <SectionCard
      title="Contacto"
      icon={PhoneIcon}
      tint="var(--accent-2)"
      isEmpty={isEmpty}
      emptyLabel="No hay direcciones, teléfonos ni correos registrados."
    >
      <div className="contact-columns">
        {addresses.length > 0 && (
          <div className="contact-col">
            <h4>Direcciones</h4>
            <ul className="fact-list">
              {addresses.map((a) => (
                <li key={a.id} className="fact-item">
                  <div className="fact-main">
                    <span>{a.address}</span>
                    {[a.city, a.province].filter(isMeaningful).length > 0 && (
                      <div className="fact-labels">
                        <span className="pill tag-pill">{[a.city, a.province].filter(isMeaningful).join(", ")}</span>
                      </div>
                    )}
                  </div>
                  <div className="fact-tags">
                    <span className="pill time-pill">{formatRelativeTime(a.lastSeenAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {phones.length > 0 && (
          <div className="contact-col">
            <h4>Teléfonos</h4>
            <ul className="fact-list">
              {phones.map((p) => (
                <li key={p.id} className="fact-item">
                  <div className="fact-main">
                    <span>{p.phoneNumber}</span>
                    {isMeaningful(p.phoneType) && (
                      <div className="fact-labels">
                        <span className="pill tag-pill">{p.phoneType}</span>
                      </div>
                    )}
                  </div>
                  <div className="fact-tags">
                    <span className="pill time-pill">{formatRelativeTime(p.lastSeenAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {emails.length > 0 && (
          <div className="contact-col">
            <h4>Correos</h4>
            <ul className="fact-list">
              {emails.map((e) => (
                <li key={e.id} className="fact-item">
                  <div className="fact-main">
                    <span>{e.address}</span>
                    {!e.isActive && (
                      <div className="fact-labels">
                        <span className="pill inactive-pill">Inactivo</span>
                      </div>
                    )}
                  </div>
                  <div className="fact-tags">
                    <span className="pill time-pill">{formatRelativeTime(e.lastSeenAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
