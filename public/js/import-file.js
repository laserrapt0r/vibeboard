// Dateien aus anderen Programmen einlesen. Auf dem Board und auf der Startseite gleich.
import { T } from './i18n.js';

export async function readForeign(file) {
  try {
    if (/\.pptx$/i.test(file.name)) {
      const { parsePptx } = await import('./pptx-import.js');
      const r = await parsePptx(await file.arrayBuffer());
      return { elements: r.elements, skipped: r.skipped.images + r.skipped.other };
    }
    const { parseDrawio } = await import('./import-drawio.js');
    return { elements: await parseDrawio(await file.text()), skipped: 0 };
  } catch {
    throw new Error(T`„${file.name}“ konnte nicht gelesen werden. Ist die Datei beschädigt?`);
  }
}
