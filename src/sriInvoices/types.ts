// Tipos de comprobante que expone el select frmPrincipal:cmbTipoComprobante
// en "Comprobantes electrónicos recibidos" — los value= son los que usa el
// propio portal, no algo que inventemos nosotros.
export const DOCUMENT_TYPES = {
  1: "Factura",
  2: "Liquidación de compra de bienes y prestación de servicios",
  3: "Notas de Crédito",
  4: "Notas de Débito",
  6: "Comprobante de Retención",
} as const;

export type DocumentTypeCode = keyof typeof DOCUMENT_TYPES;

export function isDocumentTypeCode(value: number): value is DocumentTypeCode {
  return value in DOCUMENT_TYPES;
}

export interface Period {
  year: number;
  month: number; // 1-12
}

/** Un comprobante encontrado en la tabla de resultados, ya con su posición para poder descargarlo. */
export interface ComprobanteRow {
  /** Índice de la fila dentro de la página actual (data-ri) — hace falta para armar el id del link de descarga. */
  rowIndex: number;
  claveAcceso: string;
  emisorRuc: string;
  emisorNombre: string;
  fechaEmision: string; // dd/mm/yyyy, tal cual la muestra el SRI
  tipoYSerie: string;
}

export interface SriInvoiceJobParams {
  jobId: string;
  ruc: string;
  password: string;
  documentType: DocumentTypeCode;
  from: Period;
  to: Period;
}

export interface SriInvoiceJobProgress {
  totalFound: number;
  totalDownloaded: number;
}
