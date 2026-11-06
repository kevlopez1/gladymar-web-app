// Pruebas de las funciones del panel con un GitHub falso: `npm test`. No tocan la red.
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.PANEL_CLAVE = "clave-de-prueba";
process.env.GITHUB_TOKEN = "token-falso";
process.env.GITHUB_REPO = "duenio/gladymar-web";
const { default: guardar, validar } = await import("../api/guardar.js");
const { default: subir } = await import("../api/subir.js");
const { rutaValida } = await import("../api/_comun.js");

function respuesta() {
  const r = { code: 0, data: null, status(c) { r.code = c; return r; }, json(d) { r.data = d; return r; } };
  return r;
}
const pedido = (clave, body, method = "POST") => ({ method, headers: { "x-clave": clave }, body });
function githubFalso({ conflictoUnaVez = false } = {}) {
  const llamadas = [];
  let conflicto = conflictoUnaVez;
  globalThis.fetch = async (url, op = {}) => {
    const ruta = url.replace("https://api.github.com/repos/duenio/gladymar-web", "");
    const body = op.body ? JSON.parse(op.body) : null;
    llamadas.push({ ruta, metodo: op.method || "GET", body });
    const ok = (d) => ({ ok: true, status: 200, json: async () => d, text: async () => JSON.stringify(d) });
    if (ruta === "/git/ref/heads/main") return ok({ object: { sha: "a".repeat(40) } });
    if (ruta.startsWith("/git/commits/")) return ok({ tree: { sha: "b".repeat(40) } });
    if (ruta === "/git/trees") return ok({ sha: "c".repeat(40) });
    if (ruta === "/git/commits") return ok({ sha: "d".repeat(40) });
    if (ruta === "/git/blobs") return ok({ sha: "e".repeat(40) });
    if (ruta === "/git/refs/heads/main") {
      if (conflicto) { conflicto = false; return { ok: false, status: 422, text: async () => "Update is not a fast forward" }; }
      return ok({});
    }
    return { ok: false, status: 404, text: async () => "no" };
  };
  return llamadas;
}

test("sin la clave no se escribe nada", async () => {
  const llamadas = githubFalso();
  const r = respuesta();
  await guardar(pedido("otra", { archivos: [{ ruta: "contenido.json", texto: "{}" }] }), r);
  assert.equal(r.code, 401);
  assert.equal(llamadas.length, 0);
});

test("un solo commit con todos los archivos, sin forzar", async () => {
  const llamadas = githubFalso();
  const r = respuesta();
  await guardar(pedido("clave-de-prueba", { mensaje: "textos", archivos: [
    { ruta: "contenido.json", texto: '{"pie":"Hola"}' }, { ruta: "public/img/legado.webp", sha: "f".repeat(40) }] }), r);
  assert.equal(r.code, 200, JSON.stringify(r.data));
  const arbol = llamadas.find((l) => l.ruta === "/git/trees").body.tree;
  assert.deepEqual(arbol.map((t) => t.path), ["contenido.json", "public/img/legado.webp"]);
  assert.equal(llamadas.filter((l) => l.ruta === "/git/commits" && l.metodo === "POST").length, 1);
  assert.equal(llamadas.find((l) => l.metodo === "PATCH").body.force, false);
});

test("si alguien guardó entre medio, se rehace sobre lo nuevo", async () => {
  const llamadas = githubFalso({ conflictoUnaVez: true });
  const r = respuesta();
  await guardar(pedido("clave-de-prueba", { archivos: [{ ruta: "contenido.json", texto: "{}" }] }), r);
  assert.equal(r.code, 200);
  assert.equal(llamadas.filter((l) => l.metodo === "PATCH").length, 2);
});

test("el panel no puede tocar el código ni el diseño", () => {
  for (const r of ["plantilla.html", "build.mjs", "api/guardar.js", "vercel.json", "public/index.html", "public/img/../../build.mjs", "public/panel/index.html", "../x.webp"])
    assert.equal(rutaValida(r), false, r);
  for (const r of ["contenido.json", "public/catalogos/indice.json", "public/img/legado.webp", "public/catalogos/nuevo/p1.webp"])
    assert.equal(rutaValida(r), true, r);
  assert.throws(() => validar([{ ruta: "contenido.json", texto: "{roto" }]), /JSON/);
  assert.throws(() => validar([{ ruta: "public/catalogos/indice.json", texto: '[{"id":1,"titulo":"A","paginas":[]}]' }]), /página/);
});

test("subir: una imagen devuelve su sha; una ruta ajena se rechaza", async () => {
  githubFalso();
  let r = respuesta();
  await subir(pedido("clave-de-prueba", { ruta: "public/img/x.webp", base64: "AAAA" }), r);
  assert.deepEqual([r.code, r.data.sha], [200, "e".repeat(40)]);
  r = respuesta();
  await subir(pedido("clave-de-prueba", { ruta: "api/guardar.js", base64: "AAAA" }), r);
  assert.equal(r.code, 400);
});

test("si otra persona guardó el mismo archivo, no se pisa", async () => {
  const llamadas = githubFalso();
  const base = globalThis.fetch;
  globalThis.fetch = async (url, op) => (url.includes("/compare/") ? { ok: true, status: 200, json: async () => ({ files: [{ filename: "contenido.json" }] }) } : base(url, op));
  let r = respuesta();
  await guardar(pedido("clave-de-prueba", { version: "9".repeat(40), archivos: [{ ruta: "contenido.json", texto: "{}" }] }), r);
  assert.equal(r.code, 409);
  assert.equal(llamadas.filter((l) => l.metodo === "PATCH").length, 0);
  // Una foto suelta no choca con un cambio de textos ajeno.
  r = respuesta();
  await guardar(pedido("clave-de-prueba", { version: "9".repeat(40), archivos: [{ ruta: "public/img/x.webp", sha: "f".repeat(40) }] }), r);
  assert.equal(r.code, 200);
});

test("GitHub frenando no es un error del panel: se avisa para reintentar", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 403, text: async () => "secondary rate limit" });
  const r = respuesta();
  await subir(pedido("clave-de-prueba", { ruta: "public/img/x.webp", base64: "AAAA" }), r);
  assert.deepEqual([r.code, r.data.reintentar], [429, true]);
});

test("una comparación cortada (300 archivos) cuenta como choque", async () => {
  const llamadas = githubFalso();
  const base = globalThis.fetch;
  globalThis.fetch = async (url, op) => (url.includes("/compare/") ? { ok: true, status: 200, json: async () => ({ files: Array.from({ length: 300 }, (_, i) => ({ filename: `public/catalogos/a/p${i}.webp` })) }) } : base(url, op));
  const r = respuesta();
  await guardar(pedido("clave-de-prueba", { version: "9".repeat(40), archivos: [{ ruta: "public/catalogos/indice.json", texto: '[{"id":1,"titulo":"A","paginas":["/x.webp"]}]' }] }), r);
  assert.equal(r.code, 409);
  assert.equal(llamadas.filter((l) => l.metodo === "PATCH").length, 0);
});
