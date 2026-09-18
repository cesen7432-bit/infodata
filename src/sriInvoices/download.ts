import type { Page } from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { ComprobanteRow } from "./types";

const TABLE_NAME = "frmPrincipal:tablaCompRecibidos";

/**
 * Los links de XML/RIDE no son hrefs — son un postback clásico de JSF
 * (mojarra.jsfcljs) que reenvía todo el formulario marcando ese campo oculto;
 * el servidor responde con el archivo (Content-Disposition: attachment), así
 * que Chrome lo trata como descarga sin navegar. Se intercepta vía CDP en
 * vez de leer la respuesta HTTP directamente porque no hay una URL propia
 * que golpear por fuera del navegador.
 */
async function triggerDownload(page: Page, linkId: string, scratchDir: string, timeoutMs = 30000): Promise<string> {
  await fs.mkdir(scratchDir, { recursive: true });

  const client = await page.target().createCDPSession();
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: scratchDir });

  try {
    await page.evaluate((id) => {
      // "mojarra" es un global que inyecta el runtime de JSF (Mojarra) en la página — no tiene tipos.
      (window as unknown as { mojarra: { jsfcljs: (form: HTMLElement, params: Record<string, string>, target: string) => void } }).mojarra.jsfcljs(
        document.getElementById("frmPrincipal") as HTMLElement,
        { [id]: id },
        ""
      );
    }, linkId);

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const files = await fs.readdir(scratchDir).catch(() => [] as string[]);
      const finished = files.filter((f) => !f.endsWith(".crdownload") && !f.endsWith(".tmp"));
      if (finished.length > 0) return path.join(scratchDir, finished[0]);
      await new Promise((r) => setTimeout(r, 300));
    }

    throw new Error(`Descarga no completó a tiempo (${linkId})`);
  } finally {
    await client.detach().catch(() => {});
  }
}

/** Descarga XML + RIDE(PDF) de una fila de la página de resultados actualmente visible. */
export async function downloadComprobante(page: Page, row: ComprobanteRow, destDir: string, scratchRoot: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });

  const xmlScratch = path.join(scratchRoot, `_scratch-xml-${row.rowIndex}-${Date.now()}`);
  const xmlFile = await triggerDownload(page, `${TABLE_NAME}:${row.rowIndex}:lnkXml`, xmlScratch);
  await fs.rename(xmlFile, path.join(destDir, `${row.claveAcceso}.xml`));
  await fs.rm(xmlScratch, { recursive: true, force: true });

  const pdfScratch = path.join(scratchRoot, `_scratch-pdf-${row.rowIndex}-${Date.now()}`);
  const pdfFile = await triggerDownload(page, `${TABLE_NAME}:${row.rowIndex}:lnkPdf`, pdfScratch);
  await fs.rename(pdfFile, path.join(destDir, `${row.claveAcceso}.pdf`));
  await fs.rm(pdfScratch, { recursive: true, force: true });
}
