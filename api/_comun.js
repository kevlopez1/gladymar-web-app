// Lo que comparten las funciones del panel: la clave, la lectura del cuerpo y las llamadas a GitHub.
// Variables de Vercel: PANEL_CLAVE (la contraseña del panel), GITHUB_TOKEN (token con permiso de escritura SOLO
// sobre este repositorio) y GITHUB_REPO ("dueño/gladymar-web-app"). La rama que se publica es GITHUB_RAMA o "main".
import { createHash, timingSafeEqual } from "node:crypto";

export const RAMA = process.env.GITHUB_RAMA || "main";

// Archivos que el panel puede escribir. Nada fuera de esto: ni el diseño, ni el código, ni la configuración.
export const RUTA_FOTO = /^public\/(img|catalogos)\/[a-z0-9][a-z0-9_\-./]*\.(webp|jpg|jpeg|png)$/;
export const RUTAS_JSON = new Set(["contenido.json", "public/catalogos/indice.json"]);
export const rutaValida = (r) => typeof r === "string" && !r.includes("..") && !r.includes("//") && (RUTAS_JSON.has(r) || RUTA_FOTO.test(r));

const h = (s) => createHash("sha256").update(String(s)).digest();
export function claveOk(req) {
  const clave = process.env.PANEL_CLAVE;
  if (!clave) return false; // sin clave configurada, el panel queda cerrado
  return timingSafeEqual(h(req.headers["x-clave"] || ""), h(clave));
}

export async function cuerpo(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  let t = "";
  for await (const parte of req) t += parte;
  return t ? JSON.parse(t) : {};
}

export async function gh(ruta, opciones = {}) {
  const repo = process.env.GITHUB_REPO, token = process.env.GITHUB_TOKEN;
  if (!repo || !token) throw new Error("faltan GITHUB_REPO o GITHUB_TOKEN en Vercel");
  const r = await fetch(`https://api.github.com/repos/${repo}${ruta}`, {
    ...opciones,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json", ...(opciones.headers || {}) },
  });
  if (!r.ok) {
    const err = new Error(`GitHub ${r.status} en ${opciones.method || "GET"} ${ruta}: ${(await r.text()).slice(0, 300)}`);
    err.status = r.status;
    throw err;
  }
  return opciones.crudo ? r.text() : r.json();
}

// Toda respuesta del panel sale por acá: con clave mala, una espera corta para que adivinar no sea barato.
export async function atender(req, res, metodo, fn) {
  try {
    if (req.method !== metodo) return res.status(405).json({ error: "método no permitido" });
    if (!claveOk(req)) { await new Promise((ok) => setTimeout(ok, 700)); return res.status(401).json({ error: "La clave no es correcta." }); }
    res.status(200).json(await fn());
  } catch (err) {
    console.error("panel:", err); // queda en los registros de Vercel con el cómo
    // GitHub frena a quien crea mucho contenido por minuto: el panel espera y reintenta esa misma página.
    if (err.status === 429 || (err.status === 403 && /rate limit/i.test(err.message))) return res.status(429).json({ error: "GitHub pidió esperar un momento.", reintentar: true });
    res.status(err.publico ? err.publico : 500).json({ error: err.publico ? err.message : "No se pudo guardar. Intente de nuevo en un momento." });
  }
}

export function rechazo(msg, status = 400) {
  const err = new Error(msg);
  err.publico = status;
  return err;
}
