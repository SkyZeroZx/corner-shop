import type { RequestHandler } from 'express';
import { request } from 'node:http';

/** The browser talks to /api on the same origin. This forwards it to the Nest API. */
export function proxyTo(origin: string): RequestHandler {
  const target = new URL(origin);

  return (req, res) => {
    const upstream = request(
      {
        hostname: target.hostname,
        port: target.port,
        method: req.method,
        path: req.originalUrl,
        headers: { ...req.headers, host: target.host },
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );

    upstream.on('error', () => {
      if (!res.headersSent) {
        res.status(502);
      }
      res.end('API unavailable');
    });

    req.pipe(upstream);
  };
}
