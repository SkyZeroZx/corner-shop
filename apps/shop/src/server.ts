import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { proxyTo } from './server/api-proxy';
import { EdgeCache } from './server/edge-cache';
import { logOutgoingFetch } from './server/fetch-log';
import { log } from './server/log';

const SAFE = process.env['SAFE'] === '1';
const API_ORIGIN = process.env['API_ORIGIN'] ?? 'http://localhost:3000';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

logOutgoingFetch();

const app = express();
const angularApp = new AngularNodeAppEngine();
const edgeCache = new EdgeCache();

app.use('/api', proxyTo(API_ORIGIN));

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/** Everything else is rendered by Angular, behind the edge cache. */
app.use(async (req, res, next) => {
  try {
    log(`${req.method} ${req.originalUrl}  host=${req.headers.host}`);

    // Like a CDN: the cache key is host + URL. Cookies are not part of it.
    const cacheKey = `${req.headers.host}${req.originalUrl}`;
    const cached = req.method === 'GET' ? edgeCache.get(cacheKey) : undefined;
    if (cached) {
      await writeResponseToNodeResponse(cached, res);
      return;
    }

    const response = await angularApp.handle(req);
    if (!response) {
      next();
      return;
    }

    // Someone added this for performance: pages that do not say otherwise are public.
    if (!response.headers.has('cache-control')) {
      response.headers.set('cache-control', 'public, max-age=60');
    }

    await writeResponseToNodeResponse(await edgeCache.store(cacheKey, response), res);
  } catch (error) {
    next(error);
  }
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }
    log(`Corner Shop on http://localhost:${port} (${SAFE ? 'safe' : 'unsafe'} mode)`);
    log(`NG_ALLOWED_HOSTS=${process.env['NG_ALLOWED_HOSTS'] ?? '(unset, angular.json decides)'}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
