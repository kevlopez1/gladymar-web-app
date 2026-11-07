// Arma public/index.html con los textos de contenido.json y las portadas de public/catalogos/indice.json.
// Corre en Vercel en cada publicación (vercel.json) y también a mano: `node build.mjs`. No usa dependencias.
import { readFileSync, writeFileSync } from "node:fs";

const leer = (r) => readFileSync(new URL(r, import.meta.url), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/`/g, "&#96;").replace(/\$/g, "&#36;");
// (el acento grave y el $ también: un texto puede caer dentro de una plantilla de JavaScript, como el título de la calculadora)

const contenido = JSON.parse(leer("contenido.json"));
const indice = JSON.parse(leer("public/catalogos/indice.json"));
const valor = (ruta) => ruta.split(".").reduce((o, k) => (o == null ? undefined : o[k]), contenido);

const DESCARGA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
const tapas = () => indice.filter((c) => !c.oculto).map((c) => `<figure class="tapa rev"><button type="button" class="tapa-b" data-hojear="${esc(c.id)}" aria-label="Hojear ${esc(c.titulo)}"><img src="${esc(c.paginas[0])}" alt="" loading="lazy" decoding="async"></button>
  <figcaption><b>${esc(c.titulo)}</b><span>${esc(c.rubro)}</span><a class="ic" href="${esc(c.pdf)}" target="_blank" rel="noopener" aria-label="Descargar ${esc(c.titulo)} en PDF" title="Descargar el PDF">${DESCARGA}</a></figcaption></figure>`).join("\n");

const faltan = [];
const html = leer("plantilla.html").replace(/⟦([^⟧]+)⟧/g, (_m, ruta) => {
  if (ruta === "TAPAS") return tapas();
  const v = valor(ruta);
  if (typeof v !== "string") { faltan.push(ruta); return ""; }
  return esc(v);
});
// Un texto que falta no se publica en blanco: la publicación falla y la web anterior sigue en línea.
if (faltan.length) {
  console.error(`contenido.json no tiene estos textos: ${faltan.join(", ")}`);
  process.exit(1);
}
writeFileSync(new URL("public/index.html", import.meta.url), html);
console.log(`listo · public/index.html · ${Math.round(html.length / 1024)} kB · ${indice.filter((c) => !c.oculto).length} catálogos a la vista`);
