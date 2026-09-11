import { Briefcase, Car, Contact, CreditCard, Landmark, Phone, Scale, Ticket, Users, Home } from "lucide-react";
import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExpedienteResponse, Source, SourceStatus } from "../../api/types";
import { SOURCE_SLUGS } from "../format";
import { Status } from "./SourcePill";
import { IdentityHeader } from "./IdentityHeader";
import { ContactSection } from "./ContactSection";
import { FamilySection } from "./FamilySection";
import { JudicialSection } from "./JudicialSection";
import { TaxSection } from "./TaxSection";
import { TrafficFinesSection } from "./TrafficFinesSection";
import { PropertySection } from "./PropertySection";
import { VehicleSection } from "./VehicleSection";
import { LaborSection } from "./LaborSection";
import { SectionNav, SectionNavItem } from "./SectionNav";

function statusFor(sources: ExpedienteResponse["sources"], source: Source): Status {
  const s: SourceStatus | undefined = sources[SOURCE_SLUGS[source]];
  if (!s) return "unchecked";
  if (s.resolvedFrom === "error") return "error";
  if (s.blockedCaptcha) return "blocked";
  return s.found ? "found" : "not-found";
}

function isAlertStatus(status: Status): boolean {
  return status === "blocked" || status === "error";
}

interface ExpedienteViewProps {
  loading: boolean;
  error: string | null;
  data: ExpedienteResponse | null;
  onSearch: (identificacion: string) => void;
}

export function ExpedienteView({ loading, error, data, onSearch }: ExpedienteViewProps) {
  const person = data?.person ?? null;
  const sources = data?.sources ?? {};

  const judicialStatus = statusFor(sources, "SATJE");
  const taxStatus = statusFor(sources, "SRI");
  const finesStatus = statusFor(sources, "ANT");

  const navItems: SectionNavItem[] = useMemo(
    () => [
      {
        key: "contacto",
        label: "Contacto",
        icon: Contact,
        tint: "var(--accent-2)",
        count: (person?.addresses.length ?? 0) + (person?.phones.length ?? 0) + (person?.emails.length ?? 0),
      },
      { key: "vehiculos", label: "Vehículos", icon: Car, tint: "var(--accent-2)", count: person?.vehicles.length ?? 0 },
      { key: "laboral", label: "Historial laboral", icon: Briefcase, tint: "var(--warn)", count: person?.laborRecords.length ?? 0 },
      { key: "familiares", label: "Familiares", icon: Users, tint: "var(--accent)", count: person?.familyLinks.length ?? 0 },
      {
        key: "judicial",
        label: "Causas judiciales",
        icon: Scale,
        tint: "var(--accent)",
        count: person?.judicialCases.length ?? 0,
        alert: isAlertStatus(judicialStatus),
      },
      {
        key: "tributario",
        label: "Datos tributarios",
        icon: Landmark,
        tint: "var(--warn)",
        count: person?.taxRecords.length ?? 0,
        alert: isAlertStatus(taxStatus),
      },
      {
        key: "multas",
        label: "Multas de tránsito",
        icon: Ticket,
        tint: "var(--danger)",
        count: person?.trafficFines.length ?? 0,
        alert: isAlertStatus(finesStatus),
      },
      {
        key: "propiedades",
        label: "Propiedades",
        icon: Home,
        tint: "var(--accent-2)",
        count: person?.propertyRecords.length ?? 0,
      },
    ],
    [person, judicialStatus, taxStatus, finesStatus],
  );

  const [active, setActive] = useState(navItems[0].key);

  useEffect(() => {
    if (!person) return;
    setActive(navItems.find((item) => item.count > 0)?.key ?? navItems[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.identification]);

  if (loading) {
    return (
      <div className="expediente-loading">
        <div className="spinner" aria-hidden="true" />
        <p>Consultando el expediente…</p>
        <p className="expediente-loading-hint">
          Si es la primera vez que se busca esta identificación, puede tardar unos segundos mientras se consulta en vivo.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="expediente-error" role="alert">
        <h3>No se pudo completar la búsqueda</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="expediente-empty expediente-welcome">
        <h3>¿A quién buscamos hoy?</h3>
        <p>Ingresa una cédula, un RUC, un teléfono o una placa. El expediente completo aparece acá, organizado por tipo de información.</p>
        <div className="welcome-modes">
          <span className="welcome-mode" style={{ "--tint": "var(--accent-2)" } as CSSProperties}>
            <CreditCard size={15} strokeWidth={2} aria-hidden="true" /> Cédula
          </span>
          <span className="welcome-mode" style={{ "--tint": "var(--src-sri)" } as CSSProperties}>
            <Landmark size={15} strokeWidth={2} aria-hidden="true" /> RUC
          </span>
          <span className="welcome-mode" style={{ "--tint": "var(--accent)" } as CSSProperties}>
            <Phone size={15} strokeWidth={2} aria-hidden="true" /> Teléfono
          </span>
          <span className="welcome-mode" style={{ "--tint": "var(--src-datadiverservice)" } as CSSProperties}>
            <Car size={15} strokeWidth={2} aria-hidden="true" /> Placa
          </span>
        </div>
        <Link to="/ayuda" className="welcome-help-link">
          ¿No estás seguro? Mira la guía de uso →
        </Link>
      </div>
    );
  }

  const sourceStatuses = Object.values(data.sources).filter((s): s is SourceStatus => !!s);
  const sourcesChecked = sourceStatuses.length > 0;
  const anyErrored = sourceStatuses.some((s) => s.resolvedFrom === "error");

  if (!data.person) {
    return (
      <div className="expediente-empty">
        <h3>Sin resultados para {data.identification}</h3>
        <p>
          {!sourcesChecked
            ? "No reconocemos ese formato — prueba con una cédula (10 dígitos), un RUC (13 dígitos), un teléfono o una placa."
            : anyErrored
              ? "Hubo un error durante la búsqueda — no es que no exista información, la consulta falló a mitad de camino. Intenta de nuevo."
              : "No se encontró información disponible."}
        </p>
      </div>
    );
  }

  const currentPerson = data.person;

  return (
    <div className="expediente">
      <IdentityHeader person={currentPerson} />

      <SectionNav items={navItems} active={active} onSelect={setActive} />

      <div className="expediente-panel">
        {active === "contacto" && (
          <ContactSection addresses={currentPerson.addresses} phones={currentPerson.phones} emails={currentPerson.emails} />
        )}
        {active === "vehiculos" && <VehicleSection vehicles={currentPerson.vehicles} />}
        {active === "laboral" && <LaborSection records={currentPerson.laborRecords} />}
        {active === "familiares" && <FamilySection links={currentPerson.familyLinks} onSearch={onSearch} />}
        {active === "judicial" && <JudicialSection cases={currentPerson.judicialCases} status={judicialStatus} />}
        {active === "tributario" && <TaxSection records={currentPerson.taxRecords} status={taxStatus} />}
        {active === "multas" && <TrafficFinesSection fines={currentPerson.trafficFines} status={finesStatus} />}
        {active === "propiedades" && <PropertySection records={currentPerson.propertyRecords} />}
      </div>
    </div>
  );
}
