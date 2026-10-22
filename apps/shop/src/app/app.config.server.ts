import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { provideServerLabMode } from './lab/lab-mode';
import { SERVER_SECRETS } from './lab/server-secrets';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideServerLabMode(process.env['SAFE'] === '1' ? 'safe' : 'unsafe'),
    {
      provide: SERVER_SECRETS,
      useValue: {
        apiOrigin: process.env['API_ORIGIN'] ?? 'http://localhost:3000',
        internalKey: process.env['INTERNAL_API_KEY'] ?? 'sk_internal_corner_shop_demo',
      },
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
