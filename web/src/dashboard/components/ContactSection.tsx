import { Mail as MailIcon, MapPin, Phone as PhoneIcon, User } from "lucide-react";
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
            <h4 className="contact-col-head">
              <MapPin size={14} />
              Direcciones
            </h4>
            <ul className="fact-list">
              {addresses.map((a) => (
                <li key={a.id} className="contact-fact-item">
                  <div className="fact-main">
                    <span>{a.address}</span>
                    <div className="fact-labels">
                      {[a.city, a.province].filter(isMeaningful).length > 0 && (
                        <span className="pill tag-pill">{[a.city, a.province].filter(isMeaningful).join(", ")}</span>
                      )}
                      <span className="pill time-pill">{formatRelativeTime(a.lastSeenAt)}</span>
                    </div>
                  </div>
                  <User className="contact-fact-icon" size={18} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {phones.length > 0 && (
          <div className="contact-col">
            <h4 className="contact-col-head">
              <PhoneIcon size={14} />
              Teléfonos
            </h4>
            <ul className="fact-list">
              {phones.map((p) => (
                <li key={p.id} className="contact-fact-item">
                  <div className="fact-main">
                    <span>{p.phoneNumber}</span>
                    <div className="fact-labels">
                      {isMeaningful(p.phoneType) && <span className="pill tag-pill">{p.phoneType}</span>}
                      <span className="pill time-pill">{formatRelativeTime(p.lastSeenAt)}</span>
                    </div>
                  </div>
                  <User className="contact-fact-icon" size={18} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {emails.length > 0 && (
          <div className="contact-col">
            <h4 className="contact-col-head">
              <MailIcon size={14} />
              Correos
            </h4>
            <ul className="fact-list">
              {emails.map((e) => (
                <li key={e.id} className="contact-fact-item">
                  <div className="fact-main">
                    <span>{e.address}</span>
                    <div className="fact-labels">
                      {!e.isActive && <span className="pill inactive-pill">Inactivo</span>}
                      <span className="pill time-pill">{formatRelativeTime(e.lastSeenAt)}</span>
                    </div>
                  </div>
                  <User className="contact-fact-icon" size={18} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
