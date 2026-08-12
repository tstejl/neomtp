import { resolve } from 'node:path';
import { readdirSync, readFileSync, unlinkSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const root = resolve(__dirname);
const appRoot = resolve(root, 'app');
const rendererOutput = resolve(appRoot, 'dist');
const packageJson = JSON.parse(
  readFileSync(resolve(root, 'package.json'), { encoding: 'utf8' })
);
const packageInfo = {
  productName: packageJson.productName,
  description: packageJson.description,
  name: packageJson.name,
  author: packageJson.author,
  version: packageJson.version,
  repository: packageJson.repository,
  homepage: packageJson.homepage,
  bugs: packageJson.bugs,
};
const nodeBuiltins = new Set([
  'assert',
  'buffer',
  'child_process',
  'crypto',
  'events',
  'fs',
  'module',
  'os',
  'path',
  'process',
  'stream',
  'url',
  'util',
  'zlib',
]);
const isNodeBuiltin = (id) => id.startsWith('node:') || nodeBuiltins.has(id);
const externalizeNodeBuiltins = {
  name: 'externalize-node-builtins',
  enforce: 'pre',
  resolveId(id) {
    return isNodeBuiltin(id) ? { id, external: true } : null;
  },
};
const cleanMainOutput = {
  name: 'clean-main-output',
  buildStart() {
    readdirSync(appRoot)
      .filter((file) => /^main-.+\.js(?:\.map)?$/u.test(file))
      .forEach((file) => unlinkSync(resolve(appRoot, file)));
  },
};

export default defineConfig(({ mode }) => {
  const nodeEnv = mode === 'production' ? 'production' : 'development';
  const define = {
    'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    PKG_INFO: JSON.stringify(packageInfo),
  };

  return {
    main: {
      define,
      plugins: [cleanMainOutput, externalizeDepsPlugin()],
      build: {
        outDir: appRoot,
        emptyOutDir: false,
        sourcemap: true,
        rollupOptions: {
          input: resolve(appRoot, 'main.dev.js'),
          output: {
            format: 'cjs',
            entryFileNames: 'main.prod.js',
            chunkFileNames: 'main-[name]-[hash].js',
          },
        },
      },
    },
    preload: {
      define,
      plugins: [externalizeDepsPlugin()],
      build: {
        outDir: appRoot,
        emptyOutDir: false,
        sourcemap: true,
        rollupOptions: {
          input: resolve(appRoot, 'preload-src.js'),
          output: {
            format: 'cjs',
            entryFileNames: 'preload.js',
            chunkFileNames: 'preload-[name]-[hash].js',
          },
        },
      },
    },
    renderer: {
      root: appRoot,
      base: './',
      define,
      plugins: [externalizeNodeBuiltins, react({ include: /\.[jt]sx?$/ })],
      esbuild: {
        loader: 'jsx',
        include: /app\/.*\.[jt]sx?$/,
        exclude: [],
      },
      optimizeDeps: {
        esbuildOptions: {
          loader: {
            '.js': 'jsx',
          },
        },
      },
      server: {
        port: 4642,
        strictPort: true,
      },
      build: {
        outDir: rendererOutput,
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
          external: isNodeBuiltin,
          input: resolve(appRoot, 'app.html'),
        },
      },
    },
  };
});
