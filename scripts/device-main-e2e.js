/* eslint-disable no-console, no-await-in-loop, promise/catch-or-return */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { app } = require('electron');

if (process.env.NEOMTP_DEVICE_E2E !== 'true') {
  throw new Error(
    'Refusing to run the device E2E without NEOMTP_DEVICE_E2E=true'
  );
}

const root = path.resolve(__dirname, '..');
const temporaryUserData = fs.mkdtempSync(
  path.join(os.tmpdir(), 'neomtp-main-device-e2e-')
);
const temporaryHome = path.join(temporaryUserData, 'home');
const fixtureRoot = path.join(temporaryHome, 'fixtures');
const nativeOutput = path.join(temporaryUserData, 'native');
const nativeLibrary = path.join(nativeOutput, 'kalam.dylib');
const screenshotPath = path.join(os.tmpdir(), 'neomtp-device-main-e2e.png');
const remoteRoot = `/NeoMTP-E2E-${crypto.randomUUID()}`;
const onboardingSource = fs.readFileSync(
  path.join(root, 'app/constants/onboarding.js'),
  'utf8'
);
const onboardingVersion = onboardingSource.match(
  /latestUpdatePushVersion\s*=\s*['"]([^'"]+)['"]/
)?.[1];

if (!onboardingVersion) {
  throw new Error('Could not read the current onboarding version');
}

const writeFixture = (name, data) => {
  const filePath = path.join(fixtureRoot, name);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, data);

  return filePath;
};

const deterministicFixture = Buffer.alloc(1024 * 1024 + 333);

deterministicFixture.forEach((_, index) => {
  deterministicFixture[index] =
    (index * 31 + Math.floor(index / 251) + 17) % 256;
});

fs.mkdirSync(temporaryHome, { recursive: true });
fs.mkdirSync(nativeOutput, { recursive: true });

const settingsPath = path.join(
  temporaryHome,
  'Library',
  'Application Support',
  'io.github.tstejl.neomtp',
  'settings.json'
);

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(
  settingsPath,
  JSON.stringify({
    freshInstall: 0,
    onboarding: { lastFiredVersion: onboardingVersion },
    enableAutoUpdateCheck: false,
    enableBackgroundAutoUpdate: false,
    enablePrereleaseUpdates: false,
    enableUsbHotplug: false,
    mtpMode: 'kalam',
    filesPreprocessingBeforeTransfer: {
      upload: true,
      download: true,
    },
  })
);

const fixtures = {
  single: writeFixture('single.txt', 'NeoMTP single-file app E2E\n'),
  multiA: writeFixture(
    'multi-a.txt',
    'NeoMTP multiple-file app E2E\n'.repeat(97)
  ),
  multiB: writeFixture('multi-b.bin', deterministicFixture),
  treeRoot: path.join(fixtureRoot, 'tree'),
  treeFile: writeFixture('tree/nested/tree.txt', 'NeoMTP tree app E2E\n'),
};

const downloads = {
  single: path.join(temporaryHome, 'download-single'),
  multiple: path.join(temporaryHome, 'download-multiple'),
  tree: path.join(temporaryHome, 'download-tree'),
};

execFileSync(
  'go',
  [
    'build',
    '-buildvcs=false',
    '-trimpath',
    '-buildmode=c-shared',
    '-o',
    nativeLibrary,
    '.',
  ],
  {
    cwd: path.join(root, 'ffi/kalam/native'),
    env: {
      ...process.env,
      CGO_ENABLED: '1',
      CGO_CFLAGS: '-Wno-deprecated-declarations',
      GOCACHE: path.join(temporaryUserData, 'go-build-cache'),
    },
    stdio: 'inherit',
  }
);

process.env.HOME = temporaryHome;
process.env.NEOMTP_KALAM_LIB_PATH = nativeLibrary;

app.setPath('userData', temporaryUserData);
app.disableHardwareAcceleration();

let mainWindow = null;
const rendererErrors = [];
let cleanedUp = false;
let startupTimeout = null;
const cleanup = () => {
  if (cleanedUp) {
    return;
  }

  cleanedUp = true;
  if (startupTimeout) {
    clearTimeout(startupTimeout);
  }

  fs.rmSync(temporaryUserData, { recursive: true, force: true });
};

process.once('exit', cleanup);

startupTimeout = setTimeout(() => {
  console.error(
    `Timed out running the actual device E2E${
      rendererErrors.length ? `: ${rendererErrors.join('; ')}` : ''
    }`
  );
  app.exit(1);
}, 180000);

process.on('uncaughtException', (error) => {
  console.error(`Uncaught main-process error: ${error.stack || error}`);
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

const waitFor = async (predicate, timeout = 30000) => {
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

const rendererWorkflow = async (input) => {
  const api = window.neomtp;
  const requireOk = (label, response) => {
    if (!response || response.error || response.stderr) {
      throw new Error(`${label}: ${JSON.stringify(response)}`);
    }

    return response.data;
  };
  const requireTrue = (label, response) => {
    const data = requireOk(label, response);

    if (data !== true) {
      throw new Error(`${label} returned ${JSON.stringify(data)}`);
    }

    return data;
  };
  const list = async (deviceType, filePath, storageId = null) => {
    const response = await api.fileExplorer.listFiles({
      deviceType,
      filePath,
      ignoreHidden: false,
      storageId,
    });

    return requireOk(`list ${deviceType} path ${filePath}`, response);
  };
  const transfer = async ({ direction, fileList, destination, storageId }) => {
    const events = {
      errors: [],
      preprocess: 0,
      progress: 0,
      completed: 0,
    };
    const response = await api.fileExplorer.transferFiles({
      deviceType: 'mtp',
      direction,
      fileList,
      destination,
      storageId,
      onError: (event) => events.errors.push(event),
      onPreprocess: () => {
        events.preprocess += 1;
      },
      onProgress: () => {
        events.progress += 1;
      },
      onCompleted: () => {
        events.completed += 1;
      },
    });

    requireTrue(`${direction} ${JSON.stringify(fileList)}`, response);
    if (
      events.errors.length > 0 ||
      events.preprocess < 1 ||
      events.progress < 1 ||
      events.completed !== 1
    ) {
      throw new Error(
        `${direction} callback failure: ${JSON.stringify(events)}`
      );
    }

    return events;
  };
  const names = (items) => new Set(items.map((item) => item.name));
  const requireNames = (label, items, expected) => {
    const actual = names(items);

    expected.forEach((name) => {
      if (!actual.has(name)) {
        throw new Error(`${label} does not contain ${name}`);
      }
    });
  };

  let initialized = false;
  let remoteOwned = false;
  let storageId = null;
  let result = null;
  let failure = null;
  const cleanupErrors = [];

  try {
    const settingsUpdated = await api.settings.setAll({
      ...api.settings.getAll(),
      mtpMode: 'kalam',
      enableAutoUpdateCheck: false,
      enableBackgroundAutoUpdate: false,
      filesPreprocessingBeforeTransfer: {
        upload: true,
        download: true,
      },
    });

    if (settingsUpdated !== true) {
      throw new Error('Could not apply isolated device E2E settings');
    }

    const localItems = await list('local', input.fixtureRoot);

    requireNames('local fixture listing', localItems, [
      'single.txt',
      'multi-a.txt',
      'multi-b.bin',
      'tree',
    ]);

    requireTrue(
      'dispose any renderer-started MTP session',
      await api.fileExplorer.dispose({ deviceType: 'mtp' })
    );

    const deviceInfo = requireOk(
      'initialize MTP',
      await api.fileExplorer.initialize({ deviceType: 'mtp' })
    );

    initialized = true;

    const storages = requireOk(
      'list MTP storages',
      await api.fileExplorer.listStorages({ deviceType: 'mtp' })
    );
    const storageEntries = Object.entries(storages || {});

    if (storageEntries.length === 0) {
      throw new Error('The device returned no MTP storage');
    }

    storageEntries.sort(
      ([, left], [, right]) =>
        Number(right.info?.FreeSpaceInBytes || 0) -
        Number(left.info?.FreeSpaceInBytes || 0)
    );
    storageId = Number(storageEntries[0][0]);
    if (!Number.isInteger(storageId)) {
      throw new Error(`Invalid storage id: ${storageEntries[0][0]}`);
    }

    const rootItems = await list('mtp', '/', storageId);

    if (!Array.isArray(rootItems)) {
      throw new Error('The MTP root listing is not an array');
    }

    if (
      await api.fileExplorer.filesExist({
        deviceType: 'mtp',
        fileList: [input.remoteRoot],
        storageId,
      })
    ) {
      throw new Error(`Refusing to reuse remote path ${input.remoteRoot}`);
    }

    requireTrue(
      'create remote E2E directory',
      await api.fileExplorer.makeDirectory({
        deviceType: 'mtp',
        filePath: input.remoteRoot,
        storageId,
      })
    );
    remoteOwned = true;

    const transferEvents = {
      uploadSingle: await transfer({
        direction: 'upload',
        fileList: [input.fixtures.single],
        destination: input.remoteRoot,
        storageId,
      }),
      uploadMultiple: await transfer({
        direction: 'upload',
        fileList: [input.fixtures.multiA, input.fixtures.multiB],
        destination: input.remoteRoot,
        storageId,
      }),
      uploadTree: await transfer({
        direction: 'upload',
        fileList: [input.fixtures.treeRoot],
        destination: input.remoteRoot,
        storageId,
      }),
    };

    requireNames(
      'remote E2E listing',
      await list('mtp', input.remoteRoot, storageId),
      ['single.txt', 'multi-a.txt', 'multi-b.bin', 'tree']
    );
    requireNames(
      'remote tree listing',
      await list('mtp', `${input.remoteRoot}/tree`, storageId),
      ['nested']
    );
    requireNames(
      'remote nested listing',
      await list('mtp', `${input.remoteRoot}/tree/nested`, storageId),
      ['tree.txt']
    );

    transferEvents.downloadSingle = await transfer({
      direction: 'download',
      fileList: [`${input.remoteRoot}/single.txt`],
      destination: input.downloads.single,
      storageId,
    });
    transferEvents.downloadMultiple = await transfer({
      direction: 'download',
      fileList: [
        `${input.remoteRoot}/multi-a.txt`,
        `${input.remoteRoot}/multi-b.bin`,
      ],
      destination: input.downloads.multiple,
      storageId,
    });
    transferEvents.downloadTree = await transfer({
      direction: 'download',
      fileList: [`${input.remoteRoot}/tree`],
      destination: input.downloads.tree,
      storageId,
    });

    requireTrue(
      'rename remote file',
      await api.fileExplorer.renameFile({
        deviceType: 'mtp',
        filePath: `${input.remoteRoot}/multi-a.txt`,
        newFilename: 'multi-a-renamed.txt',
        storageId,
      })
    );
    if (
      await api.fileExplorer.filesExist({
        deviceType: 'mtp',
        fileList: [`${input.remoteRoot}/multi-a.txt`],
        storageId,
      })
    ) {
      throw new Error('The old remote filename still exists after rename');
    }

    if (
      !(await api.fileExplorer.filesExist({
        deviceType: 'mtp',
        fileList: [`${input.remoteRoot}/multi-a-renamed.txt`],
        storageId,
      }))
    ) {
      throw new Error('The renamed remote file does not exist');
    }

    requireTrue(
      'delete remote E2E directory',
      await api.fileExplorer.deleteFiles({
        deviceType: 'mtp',
        fileList: [input.remoteRoot],
        storageId,
      })
    );
    if (
      await api.fileExplorer.filesExist({
        deviceType: 'mtp',
        fileList: [input.remoteRoot],
        storageId,
      })
    ) {
      throw new Error('The remote E2E directory still exists after cleanup');
    }

    remoteOwned = false;

    requireTrue(
      'dispose MTP before reconnect',
      await api.fileExplorer.dispose({ deviceType: 'mtp' })
    );
    initialized = false;
    requireOk(
      'reinitialize MTP',
      await api.fileExplorer.initialize({ deviceType: 'mtp' })
    );
    initialized = true;
    const reopenedStorages = requireOk(
      'list MTP storages after reconnect',
      await api.fileExplorer.listStorages({ deviceType: 'mtp' })
    );
    const reopenedRootItems = await list('mtp', '/', storageId);

    if (!Object.prototype.hasOwnProperty.call(reopenedStorages, storageId)) {
      throw new Error(`Storage ${storageId} is unavailable after reconnect`);
    }

    if (!Array.isArray(reopenedRootItems)) {
      throw new Error('The MTP root could not be listed after reconnect');
    }

    const renderedText = document.body.innerText;

    result = {
      apiShape:
        typeof api.fileExplorer.transferFiles === 'function' &&
        typeof api.fileExplorer.listFiles === 'function',
      rootHasContent: document.querySelector('#root')?.children.length > 0,
      renderedTextLength: renderedText.length,
      localPaneVisible: renderedText.includes('fixtures'),
      phonePaneVisible: rootItems.some(
        (item) => item.name && renderedText.includes(item.name)
      ),
      onboardingDismissed: !renderedText.includes('Release at a Glance!'),
      deviceInfo,
      storageCount: storageEntries.length,
      reopenedStorageCount: Object.keys(reopenedStorages || {}).length,
      localItemCount: localItems.length,
      rootItemCount: rootItems.length,
      reopenedRootItemCount: reopenedRootItems.length,
      transferEvents,
    };
  } catch (error) {
    failure = error;
  }

  if (storageId !== null && remoteOwned) {
    try {
      const response = await api.fileExplorer.deleteFiles({
        deviceType: 'mtp',
        fileList: [input.remoteRoot],
        storageId,
      });

      if (response?.error || response?.stderr) {
        cleanupErrors.push(`remote cleanup: ${JSON.stringify(response)}`);
      } else if (
        await api.fileExplorer.filesExist({
          deviceType: 'mtp',
          fileList: [input.remoteRoot],
          storageId,
        })
      ) {
        cleanupErrors.push(
          `remote cleanup verification: ${input.remoteRoot} still exists`
        );
      } else {
        remoteOwned = false;
      }
    } catch (error) {
      cleanupErrors.push(`remote cleanup exception: ${error}`);
    }
  }

  if (initialized) {
    try {
      const response = await api.fileExplorer.dispose({ deviceType: 'mtp' });

      if (response?.error || response?.stderr) {
        cleanupErrors.push(`dispose: ${JSON.stringify(response)}`);
      }
    } catch (error) {
      cleanupErrors.push(`dispose exception: ${error}`);
    }
  }

  if (failure || cleanupErrors.length > 0) {
    throw new Error(
      [
        failure ? `workflow: ${failure.stack || failure}` : null,
        ...cleanupErrors,
      ]
        .filter(Boolean)
        .join('; ')
    );
  }

  return result;
};

const digest = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const requireSameFile = (source, downloaded) => {
  if (digest(source) !== digest(downloaded)) {
    throw new Error(`Downloaded file differs from source: ${downloaded}`);
  }
};

const captureScreenshot = async () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  let timeoutId;
  const timeout = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Timed out capturing the E2E screenshot')),
      5000
    );
  });
  const image = await Promise.race([
    mainWindow.webContents.capturePage(),
    timeout,
  ]).finally(() => clearTimeout(timeoutId));

  fs.writeFileSync(screenshotPath, image.toPNG());
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
  await waitFor(
    () =>
      mainWindow.webContents.executeJavaScript(
        `(() => {
          const phonePane = document.querySelector('#file-explorer-body-wrapper-mtp');
          const phoneText = phonePane?.innerText || '';

          return Boolean(
            phonePane?.querySelectorAll('img[alt]').length &&
            !phoneText.includes('not connected')
          );
        })()`,
        true
      ),
    45000
  );

  const input = {
    fixtureRoot,
    fixtures,
    downloads,
    remoteRoot,
  };
  const result = await mainWindow.webContents.executeJavaScript(
    `(${rendererWorkflow.toString()})(${JSON.stringify(input)})`,
    true
  );

  const expectedDeviceLabel =
    result.deviceInfo?.mtpDeviceInfo?.Model ||
    result.deviceInfo?.usbDeviceInfo?.Product;

  if (!expectedDeviceLabel) {
    throw new Error(
      `MTP initialization returned no device label: ${JSON.stringify(
        result.deviceInfo
      )}`
    );
  }

  await waitFor(() =>
    mainWindow.webContents.executeJavaScript(
      `document.body.innerText.includes(${JSON.stringify(
        expectedDeviceLabel
      )})`,
      true
    )
  );

  requireSameFile(fixtures.single, path.join(downloads.single, 'single.txt'));
  requireSameFile(
    fixtures.multiA,
    path.join(downloads.multiple, 'multi-a.txt')
  );
  requireSameFile(
    fixtures.multiB,
    path.join(downloads.multiple, 'multi-b.bin')
  );
  requireSameFile(
    fixtures.treeFile,
    path.join(downloads.tree, 'tree/nested/tree.txt')
  );

  if (
    !result.apiShape ||
    !result.rootHasContent ||
    !result.localPaneVisible ||
    !result.phonePaneVisible ||
    !result.onboardingDismissed ||
    result.renderedTextLength < 1
  ) {
    throw new Error(
      `NeoMTP did not render correctly: ${JSON.stringify(result)}`
    );
  }

  if (
    result.storageCount < 1 ||
    result.reopenedStorageCount !== result.storageCount
  ) {
    throw new Error(`Storage reconnect failed: ${JSON.stringify(result)}`);
  }

  if (rendererErrors.length > 0) {
    throw new Error(`Renderer reported errors: ${rendererErrors.join('; ')}`);
  }

  await captureScreenshot();
  console.log(
    'Actual main-process device E2E passed:',
    JSON.stringify({ ...result, screenshotPath })
  );
};

app
  .whenReady()
  .then(run)
  .then(() => {
    clearTimeout(startupTimeout);

    const quitTimeout = setTimeout(() => {
      console.error('Timed out waiting for Electron to quit after device E2E');
      app.exit(1);
    }, 5000);

    app.once('will-quit', () => clearTimeout(quitTimeout));
    app.quit();

    return null;
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
