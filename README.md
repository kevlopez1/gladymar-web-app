# Web de Cerámica Gladymar S.A.

Este repositorio (`gladymar-web-app`) tiene el sitio web de Gladymar y el panel para editarlo. Todo lo que hay acá es de Gladymar.

## Cómo está armado
- `public/`: lo que se publica (fotos, video, páginas de catálogo y el panel en `/panel`).
- `plantilla.html`: el diseño. Cada `⟦ruta⟧` es un texto de `contenido.json`, y `⟦TAPAS⟧` son las portadas de los
  catálogos.
- `contenido.json`: los textos de la web.
- `public/catalogos/indice.json`: los catálogos (orden, nombre, rubro, link del PDF y páginas).
- `fotos.json`: las fotos que se pueden cambiar desde el panel.
- `build.mjs`: arma `public/index.html`. Vercel lo corre en cada publicación (`node build.mjs`, sin dependencias).
- `api/`: las tres funciones del panel (`leer`, `subir`, `guardar`). Cada vez que se guarda, el panel hace un commit
  en `main` y Vercel vuelve a publicar la web en alrededor de un minuto.

## El panel (`/panel`)
Tiene tres pestañas:
- **Textos:** todos los textos de la web, ordenados por sección.
- **Fotos:** cambiar una foto. El navegador la ajusta al tamaño de la web antes de subirla.
- **Catálogos:** cambiar el nombre, el rubro y el link del PDF, ordenar y ocultar. Para agregar un catálogo nuevo se
  sube el PDF y sus páginas se convierten en imágenes para hojearlo en la web.

El panel solo puede escribir `contenido.json`, `public/catalogos/indice.json` y las imágenes de `public/img/` y
`public/catalogos/`. No puede tocar el diseño ni el código.

## Publicación en Vercel
1. Importar este repositorio en Vercel. Toma la configuración de `vercel.json`, así que no hay nada que elegir.
2. Cargar tres variables de entorno:
   - `PANEL_CLAVE`: la contraseña del panel;
   - `GITHUB_REPO`: este repositorio, en forma `dueño/gladymar-web-app`;
   - `GITHUB_TOKEN`: un token "fine-grained" de GitHub que tenga acceso **solo a este repositorio** y el permiso
     *Contents: Read and write*.
3. Conectar el dominio.

## Publicación fuera de Vercel (Railway u otro servidor con Node 20 o más)
`npm run build` y después `npm start`: `servidor.mjs` sirve la web y el panel en el puerto `PORT`, con las mismas tres
variables de entorno.

## Probar en una computadora
```
node build.mjs     # arma public/index.html
npm test           # prueba las funciones del panel sin tocar GitHub
```
