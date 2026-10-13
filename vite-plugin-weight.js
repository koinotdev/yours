// ============================================================
// page-weight — a build-time page-weight meter.
//
// There is no runtime library for this, and there shouldn't be: a
// library that measures how light your page is makes your page
// heavier. So the number is measured here, at build time, from the
// real emitted assets, and handed to the app as a virtual module.
//
// The catch is that the number is baked into the very bundle it
// measures, so writing it changes it. Rather than guess at the
// delta, this settles it with a few fixed-point passes: write a
// value, re-measure, repeat until it stops moving.
// ============================================================

import { gzipSync } from "node:zlib";

const VIRTUAL_ID = "virtual:weight";
const RESOLVED_ID = "\0" + VIRTUAL_ID;
const TOKEN = "__PAGE_WEIGHT__";

// decimal kB (÷1000), matching how vite reports its own output and how
// network transfer is conventionally measured — so the two tables reconcile
const kb = (bytes) => (bytes / 1000).toFixed(1);
const pad = (text, width) =>
  text + " ".repeat(Math.max(0, width - text.length));

export function pageWeight() {
  return {
    name: "page-weight",
    // run last so vite's own html plugin has already emitted index.html
    // into the bundle — otherwise the document itself goes unmeasured
    enforce: "post",

    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },

    load(id) {
      if (id !== RESOLVED_ID) return;
      // exported as a *string* so dev mode still parses: the component
      // treats an unparseable value as "unknown" and falls back to the
      // live measurement instead
      return `export const appWeight = ${JSON.stringify(TOKEN)};\n`;
    },

    generateBundle(_options, bundle) {
      const measure = () => {
        const parts = [];
        let total = 0;
        for (const [name, item] of Object.entries(bundle)) {
          const source = item.type === "asset" ? item.source : item.code;
          const buf =
            typeof source === "string"
              ? Buffer.from(source, "utf8")
              : Buffer.from(source);
          const gz = gzipSync(buf).length;
          total += gz;
          parts.push({ name, raw: buf.length, gz });
        }
        return { total, parts };
      };

      const write = (from, to) => {
        for (const item of Object.values(bundle)) {
          if (item.type === "chunk") {
            item.code = item.code.split(from).join(to);
          } else if (typeof item.source === "string") {
            item.source = item.source.split(from).join(to);
          }
        }
      };

      // the token is emitted as a string literal, so every pass can search
      // for the *quoted* value. a bare number is not unique in a bundle —
      // e.g. the mulberry32 constant 1831565813 contains "183156" — so a
      // plain substring replace could corrupt unrelated code.
      let from = TOKEN;
      let total = measure().total;
      for (let pass = 0; pass < 3; pass++) {
        const to = String(total);
        write(`"${from}"`, `"${to}"`);
        from = to;
        total = measure().total;
      }

      const { parts } = measure();
      const rows = parts.sort((a, b) => b.gz - a.gz);
      const width = Math.max(...rows.map((r) => r.name.length));
      const body = rows
        .map((r) => `    ${pad(r.name, width)}  ${pad(kb(r.gz), 6)} kB`)
        .join("\n");

      this.info(
        `\n  page weight (gzipped)\n${body}\n` +
          `    ${pad("", width)}  ${pad(kb(total), 6)} kB  total\n`,
      );
    },
  };
}
