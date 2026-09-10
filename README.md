# Expediente Único

Plataforma unificada de consulta y scraping — SATJE, SRI, ANT, Registro de la Propiedad y DataDiverService en un solo proyecto. Ver el plan de arquitectura completo para el razonamiento de cada decisión.

**Estado:** Fases 0-5 implementadas (fundaciones, las 5 fuentes, consulta masiva, vista consolidada) + interfaz web (login, dashboard de búsqueda, historial, expediente seccionado). Fase 6 (endurecimiento) parcial — ver abajo.

## Arquitectura

```
src/
  config/       validación de variables de entorno (zod)
  db/           cliente Prisma + repositorio de personas (procedencia por fuente)
  cache/        cliente Redis + caché de resultados con TTL por fuente
  queue/        colas BullMQ (una por fuente)
  auth/         login/logout con sesión opaca en BD (sin JWT), hash de contraseñas, middlewares de rol
  users/        CRUD de usuarios (solo admin)
  admin/        consulta masiva por lote de cédulas (solo admin)
  consulta/     cascada caché → BD → cola, rutas de consulta (por fuente y consolidada), historial de búsquedas
  scrapers/
    types/            contrato común SourceHandler que implementa cada fuente
    registry.ts        mapa fuente → handler, slugs de URL, concurrencia por cola
    datadiverservice/  login por Puppeteer (token), después HTTP directo
    satje/              100% HTTP — no necesita Puppeteer (ver nota abajo)
    sri/                sesión (cookies) bootstrapeada una vez, después HTTP directo
    ant/                Puppeteer con navegador persistente (sin API pública)
    rp/                 Puppeteer con sesión autenticada persistente
  workers/      un Worker BullMQ genérico por fuente (genericWorker.ts)

web/            SPA (React + Vite + TypeScript) — login, dashboard de búsqueda,
                historial de últimas consultas, expediente seccionado por fuente.
                El propio proceso `api` la sirve como estáticos (sin contenedor
                aparte); en dev corre su propio servidor con proxy a la API.
```

## Fuentes: qué necesita cada una

| Fuente | Mecanismo | Notas |
|---|---|---|
| DataDiverService | Login Puppeteer (token ~5h) + HTTP | Requiere `DATADIVERSERVICE_USER/PASS` |
| SATJE | 100% HTTP, sin Puppeteer | La API de búsqueda acepta el literal `recaptcha:"verdad"` — no hace falta resolver nada. El export a PDF del proyecto original (que sí usa Puppeteer+CAPTCHA) no se portó: es una función de exportación, no de captura de datos |
| SRI | Sesión (cookies) bootstrapeada con Puppeteer, luego HTTP directo | Si el SRI devuelve CAPTCHA, se reintenta una vez con sesión nueva; si persiste, el job queda `blockedCaptcha` en vez de reintentar indefinidamente (presupuesto $0, plan sección 09) |
| ANT | Puppeteer, navegador persistente compartido | No tiene API pública — cada consulta abre una página nueva, no un proceso nuevo |
| Registro de la Propiedad | Puppeteer, sesión autenticada persistente | Requiere `RP_USERNAME/PASSWORD` de una cuenta habilitada |

## Autenticación: seeder + sesiones en BD

No hay credenciales de admin en el `.env` — el primer usuario se crea con un **seeder** (`prisma/seed.js`), no leyendo variables de entorno:

```bash
node prisma/seed.js                              # admin@expediente-unico.local + password aleatoria
node prisma/seed.js correo@dominio.com MiClave123  # o con datos elegidos
```

Es idempotente (si ya hay usuarios, no hace nada) y corre solo cuando: (a) lo llamás a mano, (b) `npm run prisma:migrate` lo dispara automático en dev, o (c) el contenedor `api` lo corre en cada arranque de Docker. La primera vez que corre sin argumentos, la contraseña generada se imprime **una sola vez** en la consola/logs — hay que guardarla ahí y cambiarla después con `PATCH /api/admin/users/:id`.

El login (`POST /api/auth/login`) no emite un JWT — genera un token opaco (256 bits al azar, sin payload ni firma) y **guarda su hash en la tabla `sessions`**, con vencimiento a `SESSION_TTL_HOURS` (default 8h). `requireAuth` valida el token contra esa tabla en cada request: no hay atajo "verificar sin tocar la BD" porque no hay nada que decodificar — la fila en `sessions` es la única fuente de verdad, así que no hace falta gestionar ningún secreto de firma. Por diseño, **un usuario solo puede tener una sesión activa a la vez**: cada login nuevo cierra cualquier sesión anterior de ese mismo usuario. `POST /api/auth/logout` cierra la sesión actual antes de que expire sola, y un admin que desactiva, cambia el rol o la contraseña de alguien le cierra la sesión en el acto — no hay que esperar a que el token expire.

## Correr en local (sin Docker)

```bash
cp .env.example .env        # completa credenciales de DataDiverService y RP
npm install
npm run prisma:migrate      # crea las tablas y siembra el primer admin
npm run dev:api             # proceso API, con recarga
npm run dev:worker          # proceso worker (las 5 colas), en otra terminal

cd web && npm install && npm run dev   # SPA en :5173 (o el siguiente puerto libre),
                                        # con proxy a la API — abrí esa URL en el navegador
```

## Correr todo con Docker (como se despliega en el VPS)

```bash
cp .env.example .env
docker compose up --build
docker compose logs api     # ahí sale el email/password del admin la primera vez
```

Levanta postgres, redis, `api` (aplica migraciones, siembra el admin si no existe, sirve la API y la SPA ya compilada en `:3000`) y `worker`. Entrá a `http://<tu-vps>:3000` y ahí está la interfaz — no hay puerto ni contenedor aparte para el frontend.

### Detrás de un proxy inverso con subruta (`/infodata`)

En el VPS, Apache expone la app bajo `https://apps-cecom.cloud/infodata/`:

```apache
<Location /infodata>
    ProxyPass         http://127.0.0.1:3031
    ProxyPassReverse  http://127.0.0.1:3031
</Location>
```

Apache **no** recorta el prefijo, así que la app tiene que servir todo bajo
`/infodata`. Eso lo controla una sola variable:

- **`BASE_PATH=/infodata`** — hace que Express monte la API y la SPA en ese
  prefijo (`docker-compose.yml` ya la fija para el contenedor `api`; para correr
  sin Docker, ponela en el `.env`).
- **`VITE_BASE_PATH=/infodata/`** (con barra final) — la SPA se compila con esa
  base para que los assets, el router de React y las llamadas a `/api` salgan
  con el prefijo. En Docker es un `build arg` (ya configurado en
  `docker-compose.yml`); a mano: `VITE_BASE_PATH=/infodata/ npm run build` en `web/`.

Con `BASE_PATH` vacío (default) la app se sirve en la raíz, como antes. Una
petición a `/` se redirige a `/infodata/`.

## Endpoints

```
POST   /api/auth/login
POST   /api/auth/logout                    cierra la sesión actual (requiere estar logueado)
GET    /api/auth/me                        rehidrata la sesión al recargar la página

GET    /api/consulta/historial             últimas 10 búsquedas del usuario logueado

GET    /api/admin/users
POST   /api/admin/users
PATCH  /api/admin/users/:id
DELETE /api/admin/users/:id

GET    /api/admin/api-keys                 lista las API keys (nunca el valor en claro)
POST   /api/admin/api-keys                 { name: string, domains?: string[] }  -> devuelve la clave UNA vez
DELETE /api/admin/api-keys/:id             revoca (deja de funcionar de inmediato)

POST   /api/admin/consulta-masiva          { cedulas: string[], fuentes?: string[] }
GET    /api/admin/consulta-masiva          lista los últimos 50 lotes
GET    /api/admin/consulta-masiva/:jobId   progreso + resultado por ítem

GET    /api/consulta/:identificacion               vista consolidada, las 5 fuentes en paralelo
                                                     acepta sesión (Bearer <token>) o API key
GET    /api/consulta/:fuente/:identificacion        una sola fuente (solo sesión)
                                                     fuente ∈ datadiverservice | satje | sri | ant | rp
```

Una consulta a una fuente bloqueada por CAPTCHA responde `423 Locked` con `blockedCaptcha: true` — significa que el bypass gratuito no pudo resolverlo y el dato requiere reintentar más tarde o revisión manual.

### API keys (integración de otro sistema)

Para que un sistema externo consulte el expediente consolidado sin usar el login de usuario. La clave **solo** habilita `GET /api/consulta/:identificacion` — ningún otro endpoint. Se crean y revocan desde la pantalla **API keys** del panel admin (o vía `/api/admin/api-keys`). Se guarda solo el hash; el valor en claro (`dc_live_...`) se muestra una única vez al crearla.

```bash
# la clave va en el header X-API-Key (o Authorization: Bearer dc_live_...)
# detrás del proxy la ruta lleva el prefijo: /infodata/api/consulta/...
curl https://apps-cecom.cloud/infodata/api/consulta/0912345678 \
  -H "X-API-Key: dc_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Si a la clave se le asignan dominios, la request tiene que llegar con un `Origin` (o `Referer`) que sea uno de esos dominios o un subdominio suyo — si no, `403`. Sin dominios no hay restricción de origen (uso servidor-a-servidor). Las consultas por API key no registran historial.

## Probar el flujo de punta a punta

```bash
# 1. login (usa el email/password que imprimió prisma/seed.js)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@expediente-unico.local","password":"..."}'
# guarda el "token" de la respuesta para los siguientes pasos

# 2. consulta consolidada (dispara las 5 fuentes; primera vez pasa por los scrapers, después cache/BD)
curl http://localhost:3000/api/consulta/0912345678 \
  -H "Authorization: Bearer <token>"

# 3. consulta masiva
curl -X POST http://localhost:3000/api/admin/consulta-masiva \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"cedulas":["0912345678","1791234567001"]}'
```

## Fase 6 (endurecimiento) — qué quedó y qué falta

Hecho:
- Rate limit global de la API + límite propio y más estricto en `POST /api/admin/consulta-masiva` (10/hora) — es el endpoint con más riesgo de bloqueo por IP
- Los ítems bloqueados por CAPTCHA quedan visibles en `GET /api/admin/consulta-masiva/:jobId` (`status: BLOCKED_CAPTCHA`) para revisión manual

Falta (no incluido en este alcance):
- Backups automáticos de Postgres — en el VPS, un cron con `pg_dump` contra el volumen `postgres_data` es suficiente a este volumen; no se automatizó desde aquí
- Notificación activa (email/webhook) cuando un ítem cae en `BLOCKED_CAPTCHA` — hoy es solo consultable vía API, no hay push
- Rate limiting diferenciado por rol (admin vs usuario) — hoy el límite global de la API es el mismo para ambos
