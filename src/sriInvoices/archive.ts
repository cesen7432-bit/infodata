import { ZipArchive } from "archiver";
import fs from "fs";

/** Empaqueta `sourceDir` (con su árbol de carpetas YYYY/MM/DD ya armado) en un .zip plano. */
export async function zipDirectory(sourceDir: string, outFile: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outFile);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", (err: Error) => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}
