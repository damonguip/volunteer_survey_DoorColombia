# DoorColombia · Yo me sumo

Página de inscripción de voluntarios para el lanzamiento del 21 de noviembre. Cada persona escribe su nombre y su WhatsApp una vez y toca "Me sumo" en las tareas que quiera. Todos ven en pocos segundos qué tareas ya tienen responsable.

## Estructura

- `index.html`: la página (sin frameworks).
- `api/signups.js`: función de Vercel. `GET` devuelve tareas e inscripciones; `POST` inscribe; `DELETE` quita un nombre.
- `data/tasks.json`: las tareas. Para cambiar textos, fechas o cupos, edita este archivo y vuelve a desplegar.
- `vercel.json`: hace que `/junta` abra la misma página.
- `dev-server.js`: servidor local con almacenamiento en memoria (`npm run dev`, abre http://localhost:3000).

## Desplegar en Vercel (unos 10 minutos)

1. Sube esta carpeta a un repositorio de GitHub (o usa `npx vercel` desde la carpeta).
2. En Vercel: **Add New → Project**, importa el repositorio. Framework preset: **Other**. Sin build command.
3. En el proyecto: **Storage → Create Database → Upstash (Redis)**, plan gratuito, y conéctala al proyecto. Vercel agrega solo `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
4. En **Settings → Environment Variables**, agrega `ADMIN_KEY` con una clave que solo conozca la Junta.
5. **Redeploy** para que tome las variables.
6. Dominio propio: en **Settings → Domains** agrega un subdominio (por ejemplo `voluntarios.` + el dominio de DoorColombia). Vercel muestra un registro CNAME; créalo en GoDaddy → DNS con ese nombre y valor. No toques el dominio principal ni los registros MX del correo.

## Reglas

- Cada tarea tiene un cupo (`need`). Cuando se llena, aparece como "Completa ✓".
- Cada persona puede quitar solo su propio nombre, desde el mismo teléfono con el que se inscribió.
- La Junta entra por `/junta` (por ejemplo `voluntarios.tudominio/junta`) y escribe la clave `ADMIN_KEY`. La clave se guarda solo en ese teléfono y nunca va en el enlace. Desde ahí puede quitar cualquier nombre.
- La pestaña "Quién hace qué" agrupa las tareas por persona.
- Los números de WhatsApp nunca se muestran al público: solo aparecen en la vista de Junta.

## Exportar

En la vista de Junta (`/junta`):
- **Descargar lista (Excel)**: un CSV con todas las tareas, nombres, WhatsApp y fecha de inscripción. Las tareas libres aparecen con el nombre vacío.
- **Copiar resumen para WhatsApp**: un texto con el avance y las urgentes libres, sin números, para pegar en el grupo.

## Antes del lanzamiento

Las tareas de Junta (EV02, PR02, PR04, AL07) no están en la página a propósito.
