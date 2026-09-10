import { TaxRecordInput } from "../types/scraper.types";

export function transformTaxRecord(ruc: string, contribuyente: any, establecimientos: any[]): TaxRecordInput {
  const fechas = contribuyente.informacionFechasContribuyente ?? {};

  const parsedEstablishments =
    establecimientos && establecimientos.length > 0
      ? establecimientos.map((e) => ({
          establishmentNumber: e.numeroEstablecimiento ?? null,
          name: e.nombreFantasiaComercial ?? contribuyente.razonSocial ?? null,
          location: e.direccionCompleta ?? null,
          status: e.estado ?? null,
          establishmentType: e.tipoEstablecimiento ?? null,
          isHeadquarters: e.matriz === "SI",
        }))
      : [
          {
            establishmentNumber: "001",
            name: contribuyente.razonSocial ?? null,
            location: "MATRIZ",
            status: contribuyente.estadoContribuyenteRuc ?? null,
            establishmentType: "MAT",
            isHeadquarters: true,
          },
        ];

  return {
    ruc,
    status: contribuyente.estadoContribuyenteRuc ?? null,
    taxpayerType: contribuyente.tipoContribuyente ?? null,
    regime: contribuyente.regimen ?? null,
    businessName: contribuyente.razonSocial ?? null,
    mainEconomicActivity: contribuyente.actividadEconomicaPrincipal ?? null,
    category: contribuyente.categoria ?? null,
    requiredToKeepAccounting: contribuyente.obligadoLlevarContabilidad ?? null,
    isWithholdingAgent: contribuyente.agenteRetencion ?? null,
    isSpecialTaxpayer: contribuyente.contribuyenteEspecial ?? null,
    isPhantomTaxpayer: contribuyente.contribuyenteFantasma ?? null,
    hasNonexistentTransactions: contribuyente.transaccionesInexistente ?? null,
    activitiesStartDate: fechas.fechaInicioActividades ?? null,
    cessationDate: fechas.fechaCese ?? null,
    restartDate: fechas.fechaReinicioActividades ?? null,
    lastUpdateDate: fechas.fechaActualizacion ?? null,
    legalRepresentatives: contribuyente.representantesLegales ?? null,
    cancellationReason: contribuyente.motivoCancelacionSuspension ?? null,
    establishments: parsedEstablishments,
    rawPayload: { contribuyente, establecimientos },
  };
}
