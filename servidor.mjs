// Servidor para publicar la web fuera de Vercel (Railway o cualquier servidor con Node 20+): `npm start`.
// Sirve public/ y las funciones del panel (api/). Sin dependencias.
// - Los videos se piden por partes (Range): Safari del iPhone no reproduce un video sin eso.
// - Escucha PORT y termina limpio con SIGTERM, que es lo que espera Railway.
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("./public", import.meta.url));
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".mp4": "video/mp4", ".pdf": "application/pdf", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};
const API = { leer: () => import("./api/leer.js"), subir: () => import("./api/subir.js"), guardar: () => import("./api/guardar.js") };

// Las funciones de api/ están escritas para Vercel (res.status().json()): acá se les da lo mismo.
function comoVercel(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (d) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(d)); return res; };
  return res;
}

async function archivo(req, res, ruta) {
  let p = normalize(join(RAIZ, decodeURIComponent(ruta)));
  if (p !== RAIZ && !p.startsWith(RAIZ + sep)) { res.writeHead(403).end(); return; }
  let info = await stat(p).catch(() => null);
  if (info?.isDirectory()) { p = join(p, "index.html"); info = await stat(p).catch(() => null); }
  if (!info?.isFile()) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("No encontrado"); return; }
  const ext = extname(p).toLowerCase();
  const cab = {
    "Content-Type": TIPOS[ext] || "application/octet-stream", "Accept-Ranges": "bytes", "Last-Modified": info.mtime.toUTCString(),
    // El HTML y los JSON se revalidan siempre (el panel los cambia); fotos y videos, una hora.
    "Cache-Control": ext === ".html" || ext === ".json" ? "no-cache" : "public, max-age=3600",
  };
  if (ruta.startsWith("/panel")) cab["X-Robots-Tag"] = "noindex";
  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (rango && (rango[1] || rango[2])) {
    const fin0 = info.size - 1;
    let ini = rango[1] ? +rango[1] : Math.max(0, info.size - +rango[2]);
    let fin = rango[1] && rango[2] ? Math.min(+rango[2], fin0) : fin0;
    if (ini > fin || ini >= info.size) { res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end(); return; }
    res.writeHead(206, { ...cab, "Content-Range": `bytes ${ini}-${fin}/${info.size}`, "Content-Length": fin - ini + 1 });
    if (req.method === "HEAD") { res.end(); return; }
    createReadStream(p, { start: ini, end: fin }).pipe(res);
    return;
  }
  res.writeHead(200, { ...cab, "Content-Length": info.size });
  if (req.method === "HEAD") { res.end(); return; }
  createReadStream(p).pipe(res);
}

const servidor = createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://x");
    const fn = /^\/api\/([a-z]+)$/.exec(pathname);
    if (fn) {
      if (!API[fn[1]]) { comoVercel(res).status(404).json({ error: "no existe" }); return; }
      const { default: atender } = await API[fn[1]]();
      await atender(req, comoVercel(res));
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405).end(); return; }
    await archivo(req, res, pathname);
  } catch (err) {
    console.error("servidor:", req.method, req.url, err);
    if (!res.headersSent) res.writeHead(500).end();
  }
});

const PUERTO = +process.env.PORT || 3000;
servidor.listen(PUERTO, () => console.log(`web de Gladymar escuchando en el puerto ${PUERTO}`));
process.on("SIGTERM", () => servidor.close(() => process.exit(0)));
