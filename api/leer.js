// GET /api/leer: lo que el panel muestra, leído del repositorio (no de la web publicada, que tarda un minuto en
// ponerse al día después de guardar). También sirve para validar la clave al entrar.
import { RAMA, atender, gh } from "./_comun.js";


export default (req, res) => atender(req, res, "GET", async () => {
  // La versión (el commit leído) viaja de vuelta al guardar: así nadie pisa sin saberlo lo que guardó otra persona.
  const ref = await gh(`/git/ref/heads/${RAMA}`);
  const v = ref.object.sha;
  const crudoEn = (ruta) => gh(`/contents/${ruta}?ref=${v}`, { crudo: true, headers: { Accept: "application/vnd.github.raw+json" } });
  const [contenido, indice, fotos] = await Promise.all([crudoEn("contenido.json"), crudoEn("public/catalogos/indice.json"), crudoEn("fotos.json")]);
  return { version: v, contenido: JSON.parse(contenido), indice: JSON.parse(indice), fotos: JSON.parse(fotos) };
});
