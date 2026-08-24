/* eslint-disable no-console */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import electronViteConfig from '../electron.vite.config';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const e2eScript = resolve(root, 'scripts/no-device-main-e2e.js');
const config = electronViteConfig({ mode: 'development' });
const server = await createServer({
  ...config.renderer,
  clearScreen: false,
});

let exitCode = 1;

try {
  await server.listen();

  const rendererUrl = server.resolvedUrls?.local?.[0]?.replace(/\/$/u, '');

  if (!rendererUrl) {
    throw new Error('Vite did not expose a local development renderer URL');
  }

  const electron = spawn(electronPath, [e2eScript], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl,
    },
    stdio: 'inherit',
  });

  exitCode = await new Promise((resolve, reject) => {
    electron.once('error', reject);
    electron.once('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Development Electron E2E exited via ${signal}`));

        return;
      }

      resolve(code ?? 1);
    });
  });
} finally {
  await server.close();
}

if (exitCode !== 0) {
  process.exitCode = exitCode;
}
