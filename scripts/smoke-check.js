/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));
const builderConfig = require(path.join(root, 'electron-builder-config.js'))();

const requiredFiles = [
  'app/app.html',
  'app/index.js',
  'app/main.dev.js',
  'app/preload.js',
  '.bunfig.toml',
  'bun.lock',
  'electron-builder-config.js',
  'webpack/config.main.prod.babel.js',
  'webpack/config.renderer.prod.babel.js',
];

const missingFiles = requiredFiles.filter(
  (file) => !fs.existsSync(path.join(root, file))
);
const requiredScripts = ['build', 'build-main', 'build-renderer', 'test:smoke'];
const missingScripts = requiredScripts.filter(
  (script) => !packageJson.scripts[script]
);
const packagedFiles = new Set((builderConfig.files || []).map(String));
const missingPackagedFiles = [
  'app/app.html',
  'app/preload.js',
  'app/main.prod.js',
].filter((file) => !packagedFiles.has(file));
const secureElectronFiles = [
  'app/main.dev.js',
  'app/classes/AppUpdate.js',
  'app/helpers/createWindows.js',
  'app/preload.js',
  'app/services/ipc-events/IpcEventHandler.js',
];
const secureElectronSource = secureElectronFiles
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
const insecureElectronPatterns = [
  /@electron\/remote/,
  /window\.require/,
  /nodeIntegration\s*:\s*true/,
  /contextIsolation\s*:\s*false/,
  /enableRemoteModule/,
];
const appHtml = fs.readFileSync(path.join(root, 'app/app.html'), 'utf8');
const failures = [];
const [nodeMajor, nodeMinor] = process.versions.node.split('.').map(Number);

if (!String(packageJson.packageManager || '').startsWith('bun@')) {
  failures.push('package.json must declare Bun as its package manager');
}

if (nodeMajor < 22 || (nodeMajor === 22 && nodeMinor < 12)) {
  failures.push('Node.js 22.12.0 or newer is required');
}

if (missingFiles.length) {
  failures.push(`missing required files: ${missingFiles.join(', ')}`);
}

if (missingScripts.length) {
  failures.push(`missing required scripts: ${missingScripts.join(', ')}`);
}

if (missingPackagedFiles.length) {
  failures.push(
    `builder config does not package: ${missingPackagedFiles.join(', ')}`
  );
}

if (packageJson.dependencies?.['@electron/remote']) {
  failures.push('package.json still declares @electron/remote');
}

if (
  insecureElectronPatterns.some((pattern) => pattern.test(secureElectronSource))
) {
  failures.push(
    'secure Electron files contain a legacy remote or insecure setting'
  );
}

if (!appHtml.includes('id="root"')) {
  failures.push('app/app.html does not contain the renderer root element');
}

if (!appHtml.includes('renderer.prod.js')) {
  failures.push(
    'app/app.html does not reference the production renderer bundle'
  );
}

if (failures.length) {
  console.error('Smoke checks failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Smoke checks passed for OpenMTP ${packageJson.version}`);
}
