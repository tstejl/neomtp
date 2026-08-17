/* eslint-disable no-console, no-await-in-loop, promise/catch-or-return */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');

const root = path.resolve(__dirname, '..');
const temporaryUserData = fs.mkdtempSync(
  path.join(os.tmpdir(), 'neomtp-main-no-device-e2e-')
);
const temporaryHome = path.join(temporaryUserData, 'home');

fs.mkdirSync(temporaryHome, { recursive: true });
process.env.HOME = temporaryHome;
process.env.NEOMTP_NO_DEVICE_E2E = 'true';

app.setPath('userData', temporaryUserData);
app.disableHardwareAcceleration();

let mainWindow = null;
const rendererErrors = [];
let cleanedUp = false;
const cleanup = () => {
  if (cleanedUp) {
    return;
  }

  cleanedUp = true;
  clearTimeout(startupTimeout);
  fs.rmSync(temporaryUserData, { recursive: true, force: true });
};
const startupTimeout = setTimeout(() => {
  console.error(
    `Timed out starting the actual main process${
      rendererErrors.length ? `: ${rendererErrors.join('; ')}` : ''
    }`
  );
  cleanup();
  app.exit(1);
}, 30000);

process.on('uncaughtException', (error) => {
  console.error(`Uncaught main-process error: ${error.stack || error}`);
  cleanup();
  app.exit(1);
});

app.on('browser-window-created', (_event, window) => {
  if (!mainWindow) {
    mainWindow = window;
  }

  window.webContents.on('render-process-gone', (_goneEvent, details) => {
    rendererErrors.push(
      `render process exited: ${details.reason} (${details.exitCode})`
    );
  });

  window.webContents.on(
    'preload-error',
    (_preloadEvent, preloadPath, error) => {
      rendererErrors.push(`preload error (${preloadPath}): ${error}`);
    }
  );

  window.webContents.on('console-message', ({ message }) => {
    if (/error|exception|failed/iu.test(message)) {
      rendererErrors.push(message);
    }
  });
});

require(path.join(root, 'app/main.prod.js'));

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const waitFor = async (predicate, timeout = 20000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (await predicate()) {
      return;
    }

    await wait(100);
  }

  throw new Error(
    `Timed out waiting for the actual main-process renderer${
      rendererErrors.length ? `: ${rendererErrors.join('; ')}` : ''
    }`
  );
};

const run = async () => {
  await waitFor(() => mainWindow && !mainWindow.isDestroyed());
  await waitFor(() => mainWindow.webContents.getURL().length > 0);
  await waitFor(() =>
    mainWindow.webContents.executeJavaScript(
      `Boolean(window.neomtp && document.querySelector('#root')?.children.length)`,
      true
    )
  );

  const result = await mainWindow.webContents.executeJavaScript(
    `(${async () => {
      const api = window.neomtp;
      const noDevice = await api.fileExplorer.initialize({
        deviceType: 'mtp',
      });
      const localFiles = await api.fileExplorer.listFiles({
        deviceType: 'local',
        filePath: api.app.getPaths().homeDir,
        ignoreHidden: true,
        storageId: null,
      });

      return {
        apiShape:
          typeof api.fileExplorer.initialize === 'function' &&
          typeof api.fileExplorer.listFiles === 'function' &&
          typeof api.settings.getItems === 'function',
        rootHasContent: document.querySelector('#root').children.length > 0,
        noDeviceError: noDevice?.stderr,
        localFiles: localFiles?.data,
        profileDir: api.app.getPaths().profileDir,
      };
    }})()`,
    true
  );

  if (!result.apiShape || !result.rootHasContent) {
    throw new Error(
      `Actual main-process renderer did not render NeoMTP: ${JSON.stringify(
        result
      )}`
    );
  }

  if (result.noDeviceError !== 'ErrorMtpDetectFailed') {
    throw new Error(
      `Actual no-device IPC response was not preserved: ${JSON.stringify(
        result
      )}`
    );
  }

  if (!Array.isArray(result.localFiles)) {
    throw new Error(
      `Actual local IPC response did not return a file list: ${JSON.stringify(
        result
      )}`
    );
  }

  const identifierFile = path.join(result.profileDir, 'identifier.json');
  const settingsFile = path.join(result.profileDir, 'settings.json');
  const legacyProfileDir = path.join(
    path.dirname(result.profileDir),
    'io.ganeshrvel.openmtp'
  );

  if (path.basename(result.profileDir) !== 'io.github.tstejl.neomtp') {
    throw new Error(`NeoMTP used the wrong profile: ${result.profileDir}`);
  }

  if (!fs.existsSync(identifierFile)) {
    throw new Error(
      `Fresh NeoMTP profile did not create identifier.json: ${identifierFile}`
    );
  }

  if (!fs.existsSync(settingsFile)) {
    throw new Error(
      `Fresh NeoMTP profile did not create settings.json: ${settingsFile}`
    );
  }

  if (fs.existsSync(legacyProfileDir)) {
    throw new Error(`NeoMTP created an OpenMTP profile: ${legacyProfileDir}`);
  }

  if (rendererErrors.length) {
    throw new Error(`Renderer reported errors: ${rendererErrors.join('; ')}`);
  }

  console.log(
    'Actual main-process no-device E2E passed:',
    JSON.stringify(result)
  );
};

app
  .whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    cleanup();
    app.exit(1);
  })
  .finally(() => {
    cleanup();
  });
