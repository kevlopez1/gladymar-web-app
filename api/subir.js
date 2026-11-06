// POST /api/subir {ruta, base64}: sube UNA imagen como blob de GitHub y devuelve su sha. No publica nada: la
// publicación la hace /api/guardar, en un solo commit con todo lo que se cambió.
import { RUTA_FOTO, atender, cuerpo, gh, rechazo } from "./_comun.js";

export default (req, res) => atender(req, res, "POST", async () => {
  const { ruta, base64 } = await cuerpo(req);
  if (typeof ruta !== "string" || ruta.includes("..") || !RUTA_FOTO.test(ruta)) throw rechazo("Esa ruta de imagen no está permitida.");
  if (typeof base64 !== "string" || !base64 || base64.length > 4_000_000) throw rechazo("La imagen está vacía o pesa demasiado.");
  const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: base64, encoding: "base64" }) });
  return { ruta, sha: blob.sha };
});
