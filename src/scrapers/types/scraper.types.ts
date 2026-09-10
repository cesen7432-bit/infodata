import { Source } from "@prisma/client";

export interface AddressInput {
  address: string;
  province?: string | null;
  city?: string | null;
  isValid?: string | null;
}

export interface PhoneInput {
  phoneNumber: string;
  phoneType?: string | null;
}

export interface EmailInput {
  address: string;
  isActive?: boolean;
}

export interface FamilyLinkInput {
  relatedName?: string | null;
  relatedIdentification?: string | null;
  relationshipType?: string | null;
  relatedBirthDate?: string | null;
  relatedDeathDate?: string | null;
  relatedGender?: string | null;
  relatedCivilStatus?: string | null;
  relatedAge?: number | null;
}

export interface PersonIdentityInput {
  fullName?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  gender?: string | null;
  civilStatus?: string | null;
  nationality?: string | null;
  profession?: string | null;
  placeOfBirth?: string | null;
  age?: number | null;
  salary?: string | null;
}

export interface VehicleInput {
  plate?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  color?: string | null;
  vehicleType?: string | null;
  rawPayload?: unknown;
}

export interface LaborRecordInput {
  employerName?: string | null;
  position?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  rawPayload?: unknown;
}

/** Resultado genérico de un scraper de identidad (hoy: DataDiverService). */
export interface IdentityScrapeResult {
  found: boolean;
  person?: PersonIdentityInput;
  addresses?: AddressInput[];
  phones?: PhoneInput[];
  emails?: EmailInput[];
  familyLinks?: FamilyLinkInput[];
  vehicles?: VehicleInput[];
  laborRecords?: LaborRecordInput[];
  propertyRecords?: PropertyRecordInput[];
  rawPayload?: unknown;
}

// ─────────────────────────────────────────────────────────────
// Por fuente (fases 2-4)
// ─────────────────────────────────────────────────────────────

export interface JudicialCaseInput {
  caseId: string;
  caseNumber?: string | null;
  province?: string | null;
  court?: string | null;
  role?: string | null;
  litigants?: unknown;
  incidents?: unknown;
  rawPayload?: unknown;
}

export interface TaxEstablishmentInput {
  establishmentNumber?: string | null;
  name?: string | null;
  location?: string | null;
  status?: string | null;
  establishmentType?: string | null;
  isHeadquarters?: boolean;
}

export interface TaxRecordInput {
  ruc: string;
  status?: string | null;
  taxpayerType?: string | null;
  regime?: string | null;
  businessName?: string | null;
  mainEconomicActivity?: string | null;
  category?: string | null;
  requiredToKeepAccounting?: string | null;
  isWithholdingAgent?: string | null;
  isSpecialTaxpayer?: string | null;
  isPhantomTaxpayer?: string | null;
  hasNonexistentTransactions?: string | null;
  activitiesStartDate?: string | null;
  cessationDate?: string | null;
  restartDate?: string | null;
  lastUpdateDate?: string | null;
  legalRepresentatives?: unknown;
  cancellationReason?: string | null;
  establishments: TaxEstablishmentInput[];
  rawPayload?: unknown;
}

export interface TrafficFineInput {
  plate?: string | null;
  status?: string | null;
  offenseDescription?: string | null;
  amountDue?: number | null;
  amountPaid?: number | null;
  issueDate?: string | null;
  notificationDate?: string | null;
  sanctionAmount?: number | null;
  fineAmount?: number | null;
  remissionAmount?: number | null;
  rawPayload?: unknown;
}

export interface PropertyRecordInput {
  recordType?: string | null;
  number1?: string | null;
  number2?: string | null;
  recordDate?: string | null;
  role?: string | null;
  detail?: string | null;
  rawPayload?: unknown;
}

/** Resultado crudo devuelto por `SourceHandler.fetch` — el shape exacto lo interpreta `persist`. */
export interface FetchOutcome {
  found: boolean;
  /** true cuando la fuente bloqueó la consulta con un CAPTCHA que el bypass gratuito no pudo resolver (plan, sección 09). */
  blockedCaptcha?: boolean;
  raw?: unknown;
}

/**
 * Contrato común que implementa cada scraper (identidad, causas, tributos, multas, propiedad).
 * `consulta.service` y los workers son genéricos sobre esta interfaz — no conocen los detalles
 * de cada fuente, así que agregar una fuente nueva no toca ese código común.
 */
export interface SourceHandler {
  source: Source;
  validateIdentification(identification: string): boolean;
  fetch(identification: string): Promise<FetchOutcome>;
  /** Persiste `raw` con atribución de fuente y devuelve la vista consolidada de la persona. */
  persist(identification: string, raw: unknown): Promise<unknown>;
}
