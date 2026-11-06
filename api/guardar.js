// POST /api/guardar {mensaje, archivos: [{ruta, texto} | {ruta, sha}]}: un solo commit en la rama publicada con
// todo lo que cambió. Vercel ve el commit y vuelve a publicar la web (alrededor de un minuto).
import { RAMA, RUTAS_JSON, atender, cuerpo, gh, rechazo, rutaValida } from "./_comun.js";

export function validar(archivos) {
  if (!Array.isArray(archivos) || !archivos.length || archivos.length > 400) throw rechazo("No hay cambios para guardar.");
  for (const a of archivos) {
    if (!rutaValida(a?.ruta)) throw rechazo(`No se puede escribir ${a?.ruta}.`);
    if (RUTAS_JSON.has(a.ruta)) {
      if (typeof a.texto !== "string") throw rechazo(`${a.ruta} tiene que ir como texto.`);
      let dato;
      try { dato = JSON.parse(a.texto); } catch { throw rechazo(`${a.ruta} no es un JSON válido.`); }
      if (a.ruta === "contenido.json" && (typeof dato !== "object" || Array.isArray(dato) || !dato)) throw rechazo("contenido.json tiene que ser un objeto.");
      if (a.ruta === "public/catalogos/indice.json" && (!Array.isArray(dato) || dato.some((c) => !c || !c.id || !c.titulo || !Array.isArray(c.paginas) || !c.paginas.length)))
        throw rechazo("Cada catálogo necesita título y al menos una página.");
    } else if (!/^[0-9a-f]{40}$/.test(a.sha || "")) throw rechazo(`Falta la imagen subida de ${a.ruta}.`);
  }
}

// El panel manda los JSON ENTEROS como los leyó: si otra persona guardó ese mismo archivo después, escribirlo
// borraría su cambio. Entonces se frena y se pide recargar (las fotos sueltas no chocan: cada una es su archivo).
async function chocaCon(version, punta, archivos) {
  if (!version || version === punta) return false;
  const dif = await gh(`/compare/${version}...${punta}`);
  // compare trae como mucho 300 archivos: con la lista cortada no se sabe, y ante la duda se frena.
  if (!Array.isArray(dif.files) || dif.files.length >= 300) return true;
  const tocados = new Set(dif.files.map((f) => f.filename));
  return archivos.some((a) => tocados.has(a.ruta));
}

async function commit(mensaje, archivos, version) {
  const ref = await gh(`/git/ref/heads/${RAMA}`);
  if (await chocaCon(version, ref.object.sha, archivos))
    throw rechazo("Otra persona guardó cambios en el panel mientras usted editaba. Copie lo que cambió, recargue la página y vuelva a hacerlo.", 409);
  const base = await gh(`/git/commits/${ref.object.sha}`);
  const arbol = await gh("/git/trees", { method: "POST", body: JSON.stringify({
    base_tree: base.tree.sha,
    tree: archivos.map((a) => (a.sha ? { path: a.ruta, mode: "100644", type: "blob", sha: a.sha } : { path: a.ruta, mode: "100644", type: "blob", content: a.texto })),
  }) });
  const nuevo = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: mensaje, tree: arbol.sha, parents: [ref.object.sha] }) });
  // Sin force: si alguien guardó entre medio, GitHub rechaza (422) y se rehace sobre la punta nueva, que vuelve a
  // pasar por chocaCon.
  await gh(`/git/refs/heads/${RAMA}`, { method: "PATCH", body: JSON.stringify({ sha: nuevo.sha, force: false }) });
  return nuevo.sha;
}

export default (req, res) => atender(req, res, "POST", async () => {
  const { mensaje, archivos, version } = await cuerpo(req);
  validar(archivos);
  const texto = `Panel: ${String(mensaje || "cambios en la web").slice(0, 120)}`;
  try {
    return { commit: await commit(texto, archivos, version) };
  } catch (err) {
    if (err.status !== 422) throw err;
    return { commit: await commit(texto, archivos, version) };
  }
});
