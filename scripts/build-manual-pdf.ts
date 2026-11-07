// Exporta o conteúdo do manual para JSON; o PDF é gerado por scripts/build-manual-pdf.py
import * as m from "../src/lib/manual/printed-menu-manual";
await Bun.write("/tmp/manual.json", JSON.stringify(m));
