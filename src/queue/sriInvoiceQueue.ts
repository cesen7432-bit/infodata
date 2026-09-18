import { Queue } from "bullmq";
import { queueConnection } from "./connection";
import { DocumentTypeCode, Period } from "../sriInvoices/types";

export const SRI_INVOICE_QUEUE_NAME = "sri-invoice-jobs";

export interface SriInvoiceQueueData {
  jobId: string; // id de SriInvoiceJob en Postgres
  ruc: string;
  password: string;
  documentType: DocumentTypeCode;
  from: Period;
  to: Period;
}

let queue: Queue<SriInvoiceQueueData> | null = null;

export function getSriInvoiceQueue(): Queue<SriInvoiceQueueData> {
  if (!queue) queue = new Queue<SriInvoiceQueueData>(SRI_INVOICE_QUEUE_NAME, { connection: queueConnection });
  return queue;
}

/**
 * A diferencia de enqueueConsulta, acá NO hay jobId determinista ni
 * dedup — cada descarga es un evento propio. Y a diferencia de esas colas,
 * remove-on-complete/fail es INMEDIATO (no "conservar últimos 500"): el
 * payload lleva la contraseña del SRI en texto plano y no debe quedar
 * dando vueltas en Redis más tiempo del estrictamente necesario para
 * correr el job una vez.
 */
export async function enqueueSriInvoiceJob(data: SriInvoiceQueueData) {
  return getSriInvoiceQueue().add("descargar-comprobantes", data, {
    jobId: data.jobId,
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: true,
  });
}
