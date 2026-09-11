import {
  Briefcase,
  Car,
  Contact,
  CreditCard,
  Home,
  Landmark,
  Phone,
  Scale,
  Search,
  Ticket,
  User,
  Users,
} from "lucide-react";
import { CSSProperties } from "react";
import { AppHeader } from "../dashboard/components/AppHeader";

interface SearchMode {
  icon: typeof Search;
  tint: string;
  title: string;
  example: string;
  description: string;
}

const SEARCH_MODES: SearchMode[] = [
  {
    icon: CreditCard,
    tint: "var(--accent-2)",
    title: "Cédula",
    example: "0912345678",
    description: "10 dígitos. Trae el expediente completo de la persona: identidad, contacto, vehículos, historial laboral, familiares, causas judiciales, datos tributarios, multas y propiedades.",
  },
  {
    icon: Landmark,
    tint: "var(--src-sri)",
    title: "RUC",
    example: "0912345678001",
    description: "13 dígitos. Trae los datos tributarios y, si el RUC corresponde a una persona natural, también el resto del expediente.",
  },
  {
    icon: Phone,
    tint: "var(--accent)",
    title: "Teléfono",
    example: "0991234567",
    description: "Busca dentro de lo ya consultado antes. Acepta formato local o internacional (593...), da igual cuál escribas.",
  },
  {
    icon: Car,
    tint: "var(--accent-2)",
    title: "Placa",
    example: "PBX1234",
    description: "Busca dentro de lo ya consultado y, si no está, identifica automáticamente al dueño y continúa con la búsqueda completa.",
  },
];

interface FieldSection {
  icon: typeof Search;
  tint: string;
  title: string;
  fields: string[];
}

const FIELD_SECTIONS: FieldSection[] = [
  {
    icon: User,
    tint: "var(--accent)",
    title: "Identidad",
    fields: [
      "Nombre completo",
      "Cédula / RUC",
      "Fecha de nacimiento",
      "Fecha de defunción (si aplica)",
      "Edad (calculada al momento de la búsqueda)",
      "Género",
      "Estado civil",
      "Nacionalidad",
      "Profesión",
      "Lugar de nacimiento",
    ],
  },
  {
    icon: Contact,
    tint: "var(--accent-2)",
    title: "Contacto",
    fields: ["Direcciones (con provincia y ciudad)", "Teléfonos", "Correos electrónicos"],
  },
  {
    icon: Car,
    tint: "var(--src-datadiverservice)",
    title: "Vehículos",
    fields: ["Placa", "Marca", "Modelo", "Año", "Color", "Tipo de vehículo"],
  },
  {
    icon: Briefcase,
    tint: "var(--warn)",
    title: "Historial laboral",
    fields: ["Empleador", "Cargo", "Estado (activo/inactivo)", "Fecha de ingreso"],
  },
  {
    icon: Users,
    tint: "var(--accent)",
    title: "Familiares",
    fields: ["Nombre", "Parentesco", "Cédula", "Fecha de nacimiento", "Edad calculada", "Botón para consultarlo directo"],
  },
  {
    icon: Scale,
    tint: "var(--src-satje)",
    title: "Causas judiciales",
    fields: ["Número de causa", "Judicatura", "Provincia", "Rol (actor / demandado)", "Incidentes y actuaciones"],
  },
  {
    icon: Landmark,
    tint: "var(--src-sri)",
    title: "Datos tributarios",
    fields: [
      "RUC y estado del contribuyente",
      "Tipo de contribuyente y régimen",
      "Razón social",
      "Actividad económica principal",
      "Obligado a llevar contabilidad",
      "Fechas de inicio/cese de actividades",
      "Establecimientos (con matriz/sucursal)",
    ],
  },
  {
    icon: Ticket,
    tint: "var(--src-ant)",
    title: "Multas de tránsito",
    fields: ["Placa", "Estado (pendiente / pagada)", "Descripción de la infracción", "Montos", "Fecha de emisión y notificación"],
  },
  {
    icon: Home,
    tint: "var(--src-datadiverservice)",
    title: "Propiedades",
    fields: ["Tipo de registro", "Números de trámite", "Fecha", "Rol (propietario, etc.)", "Detalle del bien"],
  },
];

export function HelpPage() {
  return (
    <div className="app-shell">
      <AppHeader />

      <main className="app-main">
        <h1 className="page-title">Ayuda</h1>

        <section className="help-intro">
          <span className="eyebrow">Cómo buscar</span>
          <h2>Un solo cuadro, cuatro formas de encontrar a alguien</h2>
          <p>
            Escribe cualquiera de estos cuatro datos en el buscador de <strong>Consulta</strong> — el sistema reconoce el
            formato solo y decide qué hacer.
          </p>
        </section>

        <div className="help-modes-grid">
          {SEARCH_MODES.map((mode) => (
            <div key={mode.title} className="help-mode-card" style={{ "--tint": mode.tint } as CSSProperties}>
              <div className="help-mode-head">
                <span className="section-icon" style={{ background: `${mode.tint}22`, color: mode.tint }}>
                  <mode.icon size={18} strokeWidth={2} aria-hidden="true" />
                </span>
                <div>
                  <h3>{mode.title}</h3>
                  <code className="help-example">{mode.example}</code>
                </div>
              </div>
              <p>{mode.description}</p>
            </div>
          ))}
        </div>

        <section className="help-intro help-intro-spaced">
          <span className="eyebrow">Qué trae cada sección</span>
          <h2>El expediente, sección por sección</h2>
          <p>Esto es lo que vas a encontrar en cada bloque de información del expediente.</p>
        </section>

        <div className="help-fields-grid">
          {FIELD_SECTIONS.map((section) => (
            <div key={section.title} className="section-card" style={{ "--tint": section.tint } as CSSProperties}>
              <header className="section-card-head">
                <div className="section-card-title">
                  <span className="section-icon" style={{ background: `${section.tint}22`, color: section.tint }}>
                    <section.icon size={18} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <h3>{section.title}</h3>
                </div>
              </header>
              <ul className="help-field-list">
                {section.fields.map((f) => (
                  <li key={f}>
                    <span className="help-field-dot" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
