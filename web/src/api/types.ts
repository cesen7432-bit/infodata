export type Role = "ADMIN" | "USER";
export type Source = "DATADIVERSERVICE" | "SATJE" | "SRI" | "ANT";

export interface CurrentUser {
  id: string;
  email: string;
  role: Role;
}

export interface Address {
  id: string;
  address: string;
  province: string | null;
  city: string | null;
  isValid: string | null;
  source: Source;
  lastSeenAt: string;
}

export interface Phone {
  id: string;
  phoneNumber: string;
  phoneType: string | null;
  source: Source;
  lastSeenAt: string;
}

export interface Email {
  id: string;
  address: string;
  isActive: boolean;
  source: Source;
  lastSeenAt: string;
}

export interface FamilyLink {
  id: string;
  relatedName: string | null;
  relatedIdentification: string | null;
  relationshipType: string | null;
  relatedBirthDate: string | null;
  relatedDeathDate: string | null;
  relatedGender: string | null;
  relatedCivilStatus: string | null;
  relatedAge: number | null;
  source: Source;
  lastSeenAt: string;
}

export interface JudicialCase {
  id: string;
  caseId: string | null;
  caseNumber: string | null;
  province: string | null;
  court: string | null;
  role: string | null;
  lastSeenAt: string;
}

export interface TaxEstablishment {
  id: string;
  establishmentNumber: string | null;
  name: string | null;
  location: string | null;
  status: string | null;
  establishmentType: string | null;
  isHeadquarters: boolean;
}

export interface TaxRecord {
  id: string;
  ruc: string;
  status: string | null;
  taxpayerType: string | null;
  regime: string | null;
  businessName: string | null;
  mainEconomicActivity: string | null;
  category: string | null;
  requiredToKeepAccounting: string | null;
  isWithholdingAgent: string | null;
  isSpecialTaxpayer: string | null;
  isPhantomTaxpayer: string | null;
  activitiesStartDate: string | null;
  cessationDate: string | null;
  establishments: TaxEstablishment[];
  lastSeenAt: string;
}

export interface TrafficFine {
  id: string;
  plate: string | null;
  status: string | null;
  offenseDescription: string | null;
  amountDue: number | null;
  amountPaid: number | null;
  issueDate: string | null;
  notificationDate: string | null;
  sanctionAmount: number | null;
  fineAmount: number | null;
  remissionAmount: number | null;
  lastSeenAt: string;
}

export interface PropertyRecord {
  id: string;
  recordType: string | null;
  number1: string | null;
  number2: string | null;
  recordDate: string | null;
  role: string | null;
  detail: string | null;
  source: Source;
  lastSeenAt: string;
}

export interface Vehicle {
  id: string;
  plate: string | null;
  brand: string | null;
  model: string | null;
  year: string | null;
  color: string | null;
  vehicleType: string | null;
  source: Source;
  lastSeenAt: string;
}

export interface LaborRecord {
  id: string;
  employerName: string | null;
  position: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  source: Source;
  lastSeenAt: string;
}

export interface Person {
  id: string;
  identification: string;
  fullName: string | null;
  birthDate: string | null;
  deathDate: string | null;
  gender: string | null;
  civilStatus: string | null;
  nationality: string | null;
  profession: string | null;
  placeOfBirth: string | null;
  age: number | null;
  salary: string | null;
  addresses: Address[];
  phones: Phone[];
  emails: Email[];
  familyLinks: FamilyLink[];
  judicialCases: JudicialCase[];
  taxRecords: TaxRecord[];
  trafficFines: TrafficFine[];
  propertyRecords: PropertyRecord[];
  vehicles: Vehicle[];
  laborRecords: LaborRecord[];
}

export interface SourceStatus {
  found: boolean;
  resolvedFrom: "cache" | "db" | "live" | "error";
  blockedCaptcha: boolean;
}

export interface ExpedienteResponse {
  identification: string;
  sources: Partial<Record<string, SourceStatus>>;
  person: Person | null;
}

export interface HistoryItem {
  identification: string;
  personFound: boolean;
  lastSearchedAt: string;
}
