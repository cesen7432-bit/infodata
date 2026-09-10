import { Cake } from "lucide-react";
import { Person } from "../../api/types";
import { calculateAge, formatDate, isBirthdayToday } from "../format";

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="id-field">
      <span className="id-field-label">{label}</span>
      <span className="id-field-value">{value || value === 0 ? value : "—"}</span>
    </div>
  );
}

export function IdentityHeader({ person }: { person: Person }) {
  const age = calculateAge(person.birthDate, person.deathDate);

  return (
    <section className="identity-header">
      <div className="identity-headline">
        <div className="identity-avatar" aria-hidden="true">
          {(person.fullName || "?").trim().charAt(0)}
        </div>
        <div>
          <h2>{person.fullName || "Nombre no disponible"}</h2>
          <div className="identity-subline">
            <span className="identity-id">{person.identification}</span>
            {age !== null && <span className="identity-age">{age} años</span>}
            {!person.deathDate && isBirthdayToday(person.birthDate) && (
              <span className="pill birthday-pill">
                <Cake size={13} strokeWidth={2} aria-hidden="true" /> Cumple hoy
              </span>
            )}
            {person.deathDate && <span className="pill status-blocked">Registrado como fallecido</span>}
          </div>
        </div>
      </div>

      <div className="identity-grid">
        <Field label="Nacimiento" value={formatDate(person.birthDate)} />
        <Field label="Defunción" value={person.deathDate ? formatDate(person.deathDate) : "—"} />
        <Field label="Edad" value={age !== null ? `${age} años` : "—"} />
        <Field label="Género" value={person.gender} />
        <Field label="Estado civil" value={person.civilStatus} />
        <Field label="Nacionalidad" value={person.nationality} />
        <Field label="Profesión" value={person.profession} />
        <Field label="Lugar de nacimiento" value={person.placeOfBirth} />
      </div>
    </section>
  );
}
