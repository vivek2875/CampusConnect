import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import express, { type Express } from 'express';

import { env } from '../../config/env';

/**
 * Serves the compiled browser application when the API is deployed as the
 * single public service. Local development continues to use Vite and Nginx.
 */
export function registerStaticClient(app: Express): void {
  if (!env.SERVE_WEB_CLIENT) return;

  const clientDirectory = resolve(env.WEB_DIST_PATH!);
  const entryFile = resolve(clientDirectory, 'index.html');

  if (!existsSync(entryFile)) {
    throw new Error(`Compiled web client was not found at ${entryFile}.`);
  }

  app.use(
    express.static(clientDirectory, {
      index: false,
      maxAge: '1y',
      immutable: true,
      setHeaders(response, path) {
        if (path.endsWith('index.html')) response.setHeader('Cache-Control', 'no-store');
      },
    }),
  );
  app.get(/^\/(?!api(?:\/|$)|health(?:\/|$)|socket\.io(?:\/|$)).*/, (_request, response) => {
    response.sendFile(entryFile);
  });
}
