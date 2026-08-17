/* eslint-disable no-console, no-await-in-loop, promise/catch-or-return */

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

if (process.env.NEOMTP_PACKAGED_DEVICE_E2E !== 'true') {
  throw new Error(
    'Refusing to run the packaged device E2E without NEOMTP_PACKAGED_DEVICE_E2E=true'
  );
}

if (process.platform !== 'darwin') {
  throw new Error('The packaged device E2E currently supports macOS only');
}

const root = path.resolve(__dirname, '..');
const packageOutputDirectory = process.arch === 'arm64' ? 'mac-arm64' : 'mac';
const appExecutable = path.join(
  root,
  `dist/${packageOutputDirectory}/NeoMTP.app/Contents/MacOS/NeoMTP`
);

if (!fs.existsSync(appExecutable)) {
  throw new Error(
    `Packaged NeoMTP executable does not exist: ${appExecutable}`
  );
}

const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'neomtp-packaged-device-e2e-')
);
const temporaryHome = path.join(temporaryRoot, 'home');
const fixtureRoot = path.join(temporaryHome, 'fixtures');
const screenshotPath = path.join(os.tmpdir(), 'neomtp-packaged-device-e2e.png');
const remoteRoot = `/NeoMTP-Packaged-E2E-${crypto.randomUUID()}`;
const uiRemoteRoot = `/NeoMTP-Packaged-UI-E2E-${crypto.randomUUID()}`;
const uiRemoteName = path.basename(uiRemoteRoot);
const debuggingPort = 20000 + crypto.randomInt(20000);

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

const settingsPath = path.join(
  temporaryHome,
  'Library',
  'Application Support',
  'io.github.tstejl.neomtp',
  'settings.json'
);

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
fs.writeFileSync(
  path.join(path.dirname(settingsPath), 'identifier.json'),
  JSON.stringify({ machineId: crypto.randomUUID() })
);
fs.writeFileSync(
  settingsPath,
  JSON.stringify({
    freshInstall: 0,
    enableAutoUpdateCheck: false,
    enableBackgroundAutoUpdate: false,
    enablePrereleaseUpdates: false,
    enableUsbHotplug: false,
    enableStatusBar: true,
    hideHiddenFiles: { local: true, mtp: true },
    fileExplorerListingType: { local: 'list', mtp: 'list' },
    mtpMode: 'kalam',
    filesPreprocessingBeforeTransfer: {
      upload: true,
      download: true,
    },
  })
);

const fixtures = {
  single: writeFixture('single.txt', 'NeoMTP packaged single-file E2E\n'),
  multiA: writeFixture(
    'multi-a.txt',
    'NeoMTP packaged multiple-file E2E\n'.repeat(97)
  ),
  multiB: writeFixture('multi-b.bin', deterministicFixture),
  treeRoot: path.join(fixtureRoot, 'tree'),
  treeFile: writeFixture('tree/nested/tree.txt', 'NeoMTP packaged tree E2E\n'),
  uiUpload: writeFixture(
    'ui-upload.bin',
    Buffer.concat([deterministicFixture, deterministicFixture])
  ),
};

const downloads = {
  single: path.join(temporaryHome, 'download-single'),
  multiple: path.join(temporaryHome, 'download-multiple'),
  tree: path.join(temporaryHome, 'download-tree'),
  ui: path.join(temporaryHome, 'download-ui'),
};

fs.mkdirSync(downloads.ui, { recursive: true });

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const fetchJson = (url) =>
  new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = '';

      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
  });

const waitForPage = async () => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30000) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${debuggingPort}/json`);
      const page = targets.find((target) => target.type === 'page');

      if (page) {
        return page;
      }
    } catch (_error) {
      // The debugging endpoint is not ready yet.
    }

    await wait(100);
  }

  throw new Error('Timed out waiting for the packaged NeoMTP renderer');
};

const connect = async (page) => {
  const socket = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let requestId = 0;
  const pending = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const resolver = pending.get(message.id);

    if (resolver) {
      pending.delete(message.id);
      resolver(message);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      requestId += 1;
      pending.set(requestId, resolve);
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });

  return { socket, send };
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
  const list = async (deviceType, filePath, storageId = null) =>
    requireOk(
      `list ${deviceType} path ${filePath}`,
      await api.fileExplorer.listFiles({
        deviceType,
        filePath,
        ignoreHidden: false,
        storageId,
      })
    );
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
  const requireNames = (label, items, expected) => {
    const actual = new Set(items.map((item) => item.name));

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
      enableUsbHotplug: false,
      filesPreprocessingBeforeTransfer: {
        upload: true,
        download: true,
      },
    });

    if (settingsUpdated !== true) {
      throw new Error('Could not apply isolated packaged E2E settings');
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
      'create remote packaged E2E directory',
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
      'remote packaged E2E listing',
      await list('mtp', input.remoteRoot, storageId),
      ['single.txt', 'multi-a.txt', 'multi-b.bin', 'tree']
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
      'delete remote packaged E2E directory',
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
      throw new Error('The remote packaged E2E directory still exists');
    }

    remoteOwned = false;
    requireTrue(
      'dispose MTP before packaged reconnect',
      await api.fileExplorer.dispose({ deviceType: 'mtp' })
    );
    initialized = false;
    requireOk(
      'reinitialize packaged MTP',
      await api.fileExplorer.initialize({ deviceType: 'mtp' })
    );
    initialized = true;

    const reopenedStorages = requireOk(
      'list MTP storages after packaged reconnect',
      await api.fileExplorer.listStorages({ deviceType: 'mtp' })
    );
    const reopenedRootItems = await list('mtp', '/', storageId);

    requireTrue(
      'dispose MTP before packaged UI reconnect',
      await api.fileExplorer.dispose({ deviceType: 'mtp' })
    );
    initialized = false;

    const renderedText = document.body.innerText;

    result = {
      apiShape:
        typeof api.fileExplorer.transferFiles === 'function' &&
        typeof api.fileExplorer.listFiles === 'function',
      rootHasContent: document.querySelector('#root')?.children.length > 0,
      renderedTextLength: renderedText.length,
      localPaneVisible: renderedText.includes('fixtures'),
      deviceInfo,
      storageCount: storageEntries.length,
      rootItemCount: rootItems.length,
      reopenedStorageCount: Object.keys(reopenedStorages || {}).length,
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
      }
    } catch (error) {
      cleanupErrors.push(`remote cleanup exception: ${error}`);
    }
  }

  if (initialized && failure) {
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

const installUiDriver = () => {
  const state = {
    progressSeen: false,
    progressTitles: [],
    snackbarMessages: [],
  };
  const visible = (element) => {
    if (!element || element.getClientRects().length === 0) {
      return false;
    }

    const style = getComputedStyle(element);

    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.getAttribute('aria-hidden') !== 'true'
    );
  };
  const pane = (deviceType) =>
    document.querySelector(`#file-explorer-body-wrapper-${deviceType}`);
  const paneRoot = (deviceType) => pane(deviceType)?.parentElement;
  const findItem = (deviceType, name) => {
    const image = [
      ...(pane(deviceType)?.querySelectorAll('img[alt]') || []),
    ].find((node) => node.getAttribute('alt') === name && visible(node));

    if (!image) {
      return null;
    }

    const rootElement =
      image.closest('tr[role="checkbox"]') ||
      image.closest('label')?.parentElement ||
      image.parentElement;
    const checkbox = rootElement?.querySelector('input[type="checkbox"]');

    return {
      checkbox,
      checkboxTarget: checkbox?.closest('.MuiButtonBase-root') || checkbox,
      openTarget: rootElement?.matches('tr')
        ? rootElement.querySelector('.nameCell')
        : rootElement,
    };
  };
  const visibleDialogs = () =>
    [...document.querySelectorAll('[role="dialog"]')].filter(visible);
  const scan = () => {
    visibleDialogs().forEach((dialog) => {
      const title = dialog.textContent.match(
        /Copying files to (?:Phone|Computer)\.\.\./
      )?.[0];

      if (title) {
        state.progressSeen = true;

        if (!state.progressTitles.includes(title)) {
          state.progressTitles.push(title);
        }
      }
    });

    const snackbar = document.querySelector('#client-snackbar');
    const message = visible(snackbar) ? snackbar.textContent.trim() : '';

    if (message && !state.snackbarMessages.includes(message)) {
      state.snackbarMessages.push(message);
    }
  };
  const observer = new MutationObserver(scan);

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  const center = (element) => {
    if (!visible(element) || element.disabled) {
      return null;
    }

    element.scrollIntoView({ block: 'center', inline: 'center' });
    const bounds = element.getBoundingClientRect();

    if (bounds.width < 1 || bounds.height < 1) {
      return null;
    }

    const x = Math.round(bounds.left + bounds.width / 2);
    const y = Math.round(bounds.top + bounds.height / 2);
    const hit = document.elementFromPoint(x, y);

    if (
      !hit ||
      !(element === hit || element.contains(hit) || hit.contains(element))
    ) {
      return null;
    }

    return { x, y };
  };
  const toolbarButton = (deviceType, label) => {
    const paneBounds = pane(deviceType)?.getBoundingClientRect();

    if (!paneBounds) {
      return null;
    }

    return [...document.querySelectorAll(`button[aria-label="${label}"]`)]
      .filter(visible)
      .find((button) => {
        const bounds = button.getBoundingClientRect();
        const x = bounds.left + bounds.width / 2;

        return x >= paneBounds.left && x <= paneBounds.right;
      });
  };
  const dialogMatching = (text) =>
    visibleDialogs().find((dialog) => dialog.innerText.includes(text));
  const rect = (spec) => {
    let target = null;

    switch (spec.kind) {
      case 'itemCheckbox':
        target = findItem(spec.deviceType, spec.name)?.checkboxTarget;
        break;
      case 'itemOpen':
        target = findItem(spec.deviceType, spec.name)?.openTarget;
        break;
      case 'breadcrumbLast': {
        const links = paneRoot(spec.deviceType)?.querySelectorAll('ul li a');

        target = links?.[links.length - 1];
        break;
      }

      case 'breadcrumb':
        target = [
          ...(paneRoot(spec.deviceType)?.querySelectorAll('ul li a') || []),
        ].find((link) => link.textContent.trim() === spec.text);
        break;
      case 'toolbar':
        target = toolbarButton(spec.deviceType, spec.label);
        break;
      case 'dialogButton': {
        const dialog = dialogMatching(spec.dialogText);

        target = [...(dialog?.querySelectorAll('button') || [])].find(
          (button) => button.textContent.trim() === spec.text
        );
        break;
      }

      case 'dialogOption': {
        const dialog = dialogMatching(spec.dialogText);
        const options = [
          ...(dialog?.querySelectorAll('[role="button"]') || []),
        ].filter(visible);

        target = options[spec.index || 0];
        break;
      }

      case 'input':
        target = document.querySelector(`#${spec.id}`);
        break;
      default:
        return null;
    }

    return center(target);
  };
  const paneState = (deviceType) => {
    const paneElement = pane(deviceType);
    const images = [
      ...(paneElement?.querySelectorAll('img[alt]') || []),
    ].filter(visible);
    const items = [
      ...new Set(images.map((image) => image.getAttribute('alt'))),
    ];
    const selected = items.filter(
      (name) => findItem(deviceType, name)?.checkbox?.checked
    );
    const breadcrumbs = [
      ...(paneRoot(deviceType)?.querySelectorAll('ul li a') || []),
    ].map((link) => link.textContent.trim());

    return {
      items,
      selected,
      breadcrumbs,
      text: paneElement?.innerText || '',
    };
  };

  window.__neomtpPackagedUi = {
    rect,
    resetTransferObservations() {
      state.progressSeen = false;
      state.progressTitles = [];
      state.snackbarMessages = [];
      scan();
    },
    snapshot() {
      scan();
      const dialogs = visibleDialogs();
      const progressVisible = dialogs.some((dialog) =>
        /Copying files to (?:Phone|Computer)\.\.\./.test(dialog.innerText)
      );
      const clipboardMatch = document.body.innerText.match(
        /(\d+) items? in clipboard/
      );

      return {
        local: paneState('local'),
        mtp: paneState('mtp'),
        activeElementId: document.activeElement?.id || '',
        clipboardCount: Number(clipboardMatch?.[1] || 0),
        dialogs: dialogs.map((dialog) => dialog.innerText),
        progressSeen: state.progressSeen,
        progressTitles: [...state.progressTitles],
        progressVisible,
        snackbarMessages: [...state.snackbarMessages],
        newFolderValue:
          document.querySelector('#newFolderDialog')?.value || null,
      };
    },
  };

  scan();

  return true;
};

const appLogs = [];
const child = spawn(
  appExecutable,
  [
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${path.join(temporaryRoot, 'chromium')}`,
    '--enable-logging=stderr',
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      HOME: temporaryHome,
      NEOMTP_DEVICE_E2E: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);

[child.stdout, child.stderr].forEach((stream) => {
  stream.on('data', (chunk) => {
    appLogs.push(chunk.toString());
  });
});

let childExited = false;

child.once('exit', () => {
  childExited = true;
});

const stopChild = async () => {
  if (childExited) {
    return;
  }

  child.kill('SIGTERM');

  const exited = await Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    wait(5000).then(() => false),
  ]);

  if (!exited) {
    child.kill('SIGKILL');
    await new Promise((resolve) => child.once('exit', resolve));
  }
};

let cleanupRemoteRoots = null;

const timeout = setTimeout(async () => {
  console.error(
    `Timed out running packaged device E2E: ${appLogs.join('').slice(-4000)}`
  );

  try {
    const cleanupResult = cleanupRemoteRoots
      ? await Promise.race([
          cleanupRemoteRoots([remoteRoot, uiRemoteRoot]),
          wait(5000).then(() => ['cleanup timed out']),
        ])
      : [];

    if (cleanupResult.length > 0) {
      console.error(`Timeout cleanup: ${cleanupResult.join('; ')}`);
    }
  } catch (error) {
    console.error(`Timeout cleanup failed: ${error.stack || error}`);
  }

  child.kill('SIGKILL');
  process.exitCode = 1;
}, 180000);

(async () => {
  const page = await waitForPage();
  const { socket, send } = await connect(page);
  const evaluate = async (expression) => {
    const response = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });

    if (response.result?.exceptionDetails) {
      throw new Error(
        response.result.exceptionDetails.exception?.description ||
          response.result.exceptionDetails.text
      );
    }

    return response.result?.result?.value;
  };

  cleanupRemoteRoots = async (paths) => {
    const cleanupResult = await evaluate(`(async (remotePaths) => {
      const api = window.neomtp;
      const errors = [];
      let storagesResponse = await api.fileExplorer.listStorages({
        deviceType: 'mtp',
      });

      if (storagesResponse?.error || storagesResponse?.stderr) {
        const initializeResponse = await api.fileExplorer.initialize({
          deviceType: 'mtp',
        });

        if (initializeResponse?.error || initializeResponse?.stderr) {
          errors.push('initialize: ' + JSON.stringify(initializeResponse));
        }

        storagesResponse = await api.fileExplorer.listStorages({
          deviceType: 'mtp',
        });
      }

      if (storagesResponse?.error || storagesResponse?.stderr) {
        errors.push('list storages: ' + JSON.stringify(storagesResponse));
      } else {
        for (const rawStorageId of Object.keys(storagesResponse.data || {})) {
          const storageId = Number(rawStorageId);

          for (const remotePath of remotePaths) {
            const listResponse = await api.fileExplorer.listFiles({
              deviceType: 'mtp',
              filePath: '/',
              ignoreHidden: false,
              storageId,
            });

            if (listResponse?.error || listResponse?.stderr) {
              errors.push(
                'list root ' + storageId + ': ' + JSON.stringify(listResponse)
              );
              continue;
            }

            const remoteName = remotePath.replace(/^\\/+/, '');
            const exists = (listResponse.data || []).some(
              (item) => item.name === remoteName || item.path === remotePath
            );

            if (!exists) {
              continue;
            }

            const deleteResponse = await api.fileExplorer.deleteFiles({
              deviceType: 'mtp',
              fileList: [remotePath],
              storageId,
            });

            if (
              deleteResponse?.error ||
              deleteResponse?.stderr ||
              deleteResponse?.data !== true
            ) {
              errors.push(
                'delete ' + storageId + ' ' + remotePath + ': ' +
                  JSON.stringify(deleteResponse)
              );
              continue;
            }

            const verification = await api.fileExplorer.listFiles({
              deviceType: 'mtp',
              filePath: '/',
              ignoreHidden: false,
              storageId,
            });

            if (
              verification?.error ||
              verification?.stderr ||
              (verification.data || []).some(
                (item) => item.name === remoteName || item.path === remotePath
              )
            ) {
              errors.push(
                'cleanup verification ' + storageId + ' ' + remotePath
              );
            }
          }
        }
      }

      const disposeResponse = await api.fileExplorer.dispose({
        deviceType: 'mtp',
      });

      if (disposeResponse?.error || disposeResponse?.stderr) {
        errors.push('dispose: ' + JSON.stringify(disposeResponse));
      }

      return errors;
    })(${JSON.stringify(paths)})`);

    if (!Array.isArray(cleanupResult)) {
      throw new Error(
        `Unexpected cleanup result: ${JSON.stringify(cleanupResult)}`
      );
    }

    return cleanupResult;
  };

  const waitForRenderer = async (label, predicate, timeoutMs = 30000) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const value = await predicate();

      if (value) {
        return value;
      }

      await wait(100);
    }

    throw new Error(`Timed out waiting for ${label}`);
  };
  const domCall = (method, ...args) =>
    evaluate(
      `window.__neomtpPackagedUi.${method}(${args
        .map((argument) => JSON.stringify(argument))
        .join(',')})`
    );
  const uiSnapshot = () => domCall('snapshot');
  const waitForUi = async (label, predicate, timeoutMs = 30000) =>
    waitForRenderer(
      label,
      async () => predicate(await uiSnapshot()),
      timeoutMs
    );
  const physicalClick = async (spec) => {
    const point = await waitForRenderer(
      `click target ${JSON.stringify(spec)}`,
      () => domCall('rect', spec),
      10000
    );

    await send('Page.bringToFront');
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: point.x,
      y: point.y,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: point.x,
      y: point.y,
      button: 'left',
      clickCount: 1,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: point.x,
      y: point.y,
      button: 'left',
      clickCount: 1,
    });
    await wait(100);
  };
  const physicalDoubleClick = async (spec) => {
    const point = await waitForRenderer(
      `double-click target ${JSON.stringify(spec)}`,
      () => domCall('rect', spec),
      10000
    );

    await send('Page.bringToFront');

    for (const clickCount of [1, 2]) {
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: point.x,
        y: point.y,
        button: 'left',
        clickCount,
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: point.x,
        y: point.y,
        button: 'left',
        clickCount,
      });
      await wait(75);
    }
  };
  const commandShortcut = async (key) => {
    const upperKey = key.toUpperCase();
    const keyCode = upperKey.charCodeAt(0);

    await send('Page.bringToFront');
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: key.toLowerCase(),
      code: `Key${upperKey}`,
      modifiers: 4,
      windowsVirtualKeyCode: keyCode,
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: key.toLowerCase(),
      code: `Key${upperKey}`,
      modifiers: 4,
      windowsVirtualKeyCode: keyCode,
    });
    await wait(150);
  };
  const typeText = async (text) => {
    for (const character of text) {
      await send('Input.dispatchKeyEvent', {
        type: 'char',
        text: character,
        unmodifiedText: character,
      });
    }
  };
  const focusPane = async (deviceType) => {
    await physicalClick({ kind: 'breadcrumbLast', deviceType });
    await waitForUi(
      `${deviceType} pane focus`,
      (state) =>
        state.activeElementId === `file-explorer-body-wrapper-${deviceType}`
    );
  };
  const selectItem = async (deviceType, name) => {
    await physicalClick({ kind: 'itemCheckbox', deviceType, name });
    await waitForUi(`${deviceType} selection ${name}`, (state) =>
      state[deviceType].selected.includes(name)
    );
  };
  const copySelection = async (deviceType) => {
    await focusPane(deviceType);
    await commandShortcut('c');
    await waitForUi(
      'one-item clipboard',
      (state) =>
        state.clipboardCount === 1 && state[deviceType].selected.length === 0
    );
  };
  const pasteAndWait = async (deviceType, itemName, title) => {
    await focusPane(deviceType);
    await domCall('resetTransferObservations');
    await commandShortcut('v');
    await waitForUi(
      `${title} progress modal`,
      (state) => state.progressSeen && state.progressTitles.includes(title)
    );
    await waitForUi(
      `${title} completion`,
      (state) => {
        if (state.snackbarMessages.length > 0) {
          throw new Error(
            `Transfer snackbar error: ${state.snackbarMessages.join('; ')}`
          );
        }

        return (
          state.progressSeen &&
          !state.progressVisible &&
          state.clipboardCount === 0 &&
          state[deviceType].items.includes(itemName)
        );
      },
      90000
    );
  };

  await waitForRenderer(
    'the packaged preload, React tree, and initial Phone session',
    async () =>
      evaluate(`(() => {
        const phonePane = document.querySelector('#file-explorer-body-wrapper-mtp');
        const phoneText = phonePane?.innerText || '';
        const phoneItems = phonePane?.querySelectorAll('img[alt]').length || 0;

        return Boolean(
          window.neomtp?.fileExplorer &&
          document.querySelector('#root')?.children.length &&
          phoneItems > 0 &&
          !phoneText.includes('not connected')
        );
      })()`),
    45000
  );
  const input = { fixtureRoot, fixtures, downloads, remoteRoot };
  const response = await send('Runtime.evaluate', {
    expression: `(${rendererWorkflow.toString()})(${JSON.stringify(input)})`,
    awaitPromise: true,
    returnByValue: true,
  });

  if (response.result?.exceptionDetails) {
    throw new Error(
      response.result.exceptionDetails.exception?.description ||
        response.result.exceptionDetails.text
    );
  }

  const result = response.result?.result?.value;

  if (!result) {
    throw new Error(
      `Packaged renderer returned no result: ${JSON.stringify(response)}`
    );
  }

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
    result.storageCount < 1 ||
    result.reopenedStorageCount !== result.storageCount
  ) {
    throw new Error(
      `Packaged NeoMTP did not render correctly: ${JSON.stringify(result)}`
    );
  }

  const expectedDeviceLabel =
    result.deviceInfo?.mtpDeviceInfo?.Model ||
    result.deviceInfo?.usbDeviceInfo?.Product;

  if (!expectedDeviceLabel) {
    throw new Error(
      `Packaged MTP initialization returned no device label: ${JSON.stringify(
        result.deviceInfo
      )}`
    );
  }

  const reloadMarker = crypto.randomUUID();

  await evaluate(
    `window.__neomtpPackagedReloadMarker = ${JSON.stringify(reloadMarker)}`
  );

  const reloadResponse = await send('Page.reload', { ignoreCache: true });

  if (reloadResponse.error) {
    throw new Error(
      `Could not reload the packaged renderer: ${JSON.stringify(
        reloadResponse.error
      )}`
    );
  }

  const packagedUi = await waitForRenderer(
    'the packaged Phone pane to reconnect after a clean renderer reload',
    async () => {
      let state;

      try {
        state = await evaluate(`(() => {
        const visible = (element) => {
          if (!element || element.getClientRects().length === 0) {
            return false;
          }

          const style = getComputedStyle(element);

          return style.display !== 'none' && style.visibility !== 'hidden';
        };
        const localPane = document.querySelector('#file-explorer-body-wrapper-local');
        const phonePane = document.querySelector('#file-explorer-body-wrapper-mtp');
        const phoneItems = [...new Set(
          [...(phonePane?.querySelectorAll('img[alt]') || [])]
            .map((image) => image.getAttribute('alt'))
        )];
        const localItems = [...new Set(
          [...(localPane?.querySelectorAll('img[alt]') || [])]
            .map((image) => image.getAttribute('alt'))
        )];

        return {
          reloadMarker: window.__neomtpPackagedReloadMarker,
          phoneItems,
          localItems,
          phoneText: phonePane?.innerText || '',
          bodyText: document.body.innerText,
          snackbarVisible: visible(document.querySelector('#client-snackbar')),
        };
        })()`);
      } catch (_error) {
        return null;
      }

      return state.reloadMarker !== reloadMarker &&
        state.phoneItems.length > 0 &&
        !state.phoneText.includes('not connected') &&
        state.bodyText.includes(expectedDeviceLabel) &&
        !state.snackbarVisible
        ? state
        : null;
    },
    45000
  );

  result.packagedUi = {
    localItemCount: packagedUi.localItems.length,
    phoneItemCount: packagedUi.phoneItems.length,
    deviceLabelVisible: packagedUi.bodyText.includes(expectedDeviceLabel),
    disconnectedMessageVisible: packagedUi.phoneText.includes('not connected'),
  };

  await evaluate(`(${installUiDriver.toString()})()`);
  await waitForUi('local fixture root', (state) =>
    state.local.items.includes('fixtures')
  );
  await physicalClick({
    kind: 'toolbar',
    deviceType: 'mtp',
    label: 'Storage',
  });
  await waitForUi('packaged UI storage dialog', (state) =>
    state.dialogs.some((dialog) => dialog.includes('Select Storage Option'))
  );
  await physicalClick({
    kind: 'dialogOption',
    dialogText: 'Select Storage Option',
    index: 0,
  });
  await waitForUi(
    'packaged UI phone root',
    (state) =>
      state.mtp.breadcrumbs[state.mtp.breadcrumbs.length - 1] === 'Root'
  );

  if ((await uiSnapshot()).mtp.items.includes(uiRemoteName)) {
    throw new Error(`Refusing to reuse packaged UI path ${uiRemoteRoot}`);
  }

  await focusPane('mtp');
  await commandShortcut('n');
  await waitForUi('packaged UI new-folder dialog', (state) =>
    state.dialogs.some((dialog) => dialog.includes('Create a new folder'))
  );
  await physicalClick({ kind: 'input', id: 'newFolderDialog' });
  await typeText(uiRemoteName);
  await waitForUi(
    'packaged UI new-folder text entry',
    (state) => state.newFolderValue === uiRemoteName
  );
  await physicalClick({
    kind: 'dialogButton',
    dialogText: 'Create a new folder',
    text: 'Create',
  });
  await waitForUi('packaged UI remote directory', (state) =>
    state.mtp.items.includes(uiRemoteName)
  );
  await physicalDoubleClick({
    kind: 'itemOpen',
    deviceType: 'mtp',
    name: uiRemoteName,
  });
  await waitForUi(
    'packaged UI remote directory breadcrumb',
    (state) =>
      state.mtp.breadcrumbs[state.mtp.breadcrumbs.length - 1] === uiRemoteName
  );

  await physicalDoubleClick({
    kind: 'itemOpen',
    deviceType: 'local',
    name: 'fixtures',
  });
  await waitForUi('packaged UI upload fixture', (state) =>
    state.local.items.includes('ui-upload.bin')
  );
  await selectItem('local', 'ui-upload.bin');
  await copySelection('local');
  await pasteAndWait('mtp', 'ui-upload.bin', 'Copying files to Phone...');

  await physicalClick({
    kind: 'toolbar',
    deviceType: 'local',
    label: 'Folder Up',
  });
  await waitForUi('packaged UI download target', (state) =>
    state.local.items.includes(path.basename(downloads.ui))
  );
  await physicalDoubleClick({
    kind: 'itemOpen',
    deviceType: 'local',
    name: path.basename(downloads.ui),
  });
  await waitForUi(
    'packaged UI download target breadcrumb',
    (state) =>
      state.local.breadcrumbs[state.local.breadcrumbs.length - 1] ===
      path.basename(downloads.ui)
  );
  await selectItem('mtp', 'ui-upload.bin');
  await copySelection('mtp');
  await pasteAndWait('local', 'ui-upload.bin', 'Copying files to Computer...');
  requireSameFile(fixtures.uiUpload, path.join(downloads.ui, 'ui-upload.bin'));

  await physicalClick({
    kind: 'breadcrumb',
    deviceType: 'mtp',
    text: 'Root',
  });
  await waitForUi('packaged UI remote root', (state) =>
    state.mtp.items.includes(uiRemoteName)
  );
  await selectItem('mtp', uiRemoteName);
  await physicalClick({
    kind: 'toolbar',
    deviceType: 'mtp',
    label: 'Delete',
  });
  await waitForUi('packaged UI delete confirmation', (state) =>
    state.dialogs.some((dialog) =>
      dialog.includes('permanently delete the items from your Phone')
    )
  );
  await physicalClick({
    kind: 'dialogButton',
    dialogText: 'permanently delete the items from your Phone',
    text: 'Yes',
  });
  await waitForUi(
    'packaged UI remote directory removal',
    (state) => !state.mtp.items.includes(uiRemoteName)
  );

  const uiDeleteVerification = await evaluate(`(async () => {
    const api = window.neomtp;
    const storages = await api.fileExplorer.listStorages({ deviceType: 'mtp' });

    if (storages?.error || storages?.stderr) {
      return { error: 'list storages: ' + JSON.stringify(storages) };
    }

    const storageIds = Object.keys(storages.data || {});

    if (storageIds.length === 0) {
      return { error: 'the device returned no storage' };
    }

    for (const rawStorageId of storageIds) {
      const storageId = Number(rawStorageId);
      const root = await api.fileExplorer.listFiles({
        deviceType: 'mtp',
        filePath: '/',
        ignoreHidden: false,
        storageId,
      });

      if (root?.error || root?.stderr) {
        return {
          error: 'list root ' + storageId + ': ' + JSON.stringify(root),
        };
      }

      if ((root.data || []).some((item) =>
        item.name === ${JSON.stringify(uiRemoteName)} ||
        item.path === ${JSON.stringify(uiRemoteRoot)}
      )) {
        return { error: null, exists: true, storageId };
      }
    }

    return { error: null, exists: false };
  })()`);

  if (uiDeleteVerification.error || uiDeleteVerification.exists) {
    throw new Error(
      `Packaged UI delete was not verified through MTP: ${JSON.stringify(
        uiDeleteVerification
      )}`
    );
  }

  const uiFinalState = await uiSnapshot();

  result.packagedUi = {
    ...result.packagedUi,
    uploaded: 'ui-upload.bin',
    downloaded: 'ui-upload.bin',
    progressSeen: uiFinalState.progressSeen,
    progressTitles: uiFinalState.progressTitles,
    progressVisible: uiFinalState.progressVisible,
    remoteDeleteVerified: true,
  };

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });

  if (!screenshot.result?.data) {
    throw new Error('Could not capture the packaged app screenshot');
  }

  fs.writeFileSync(screenshotPath, screenshot.result.data, 'base64');

  const disposeResponse = await send('Runtime.evaluate', {
    expression: "window.neomtp.fileExplorer.dispose({ deviceType: 'mtp' })",
    awaitPromise: true,
    returnByValue: true,
  });

  if (disposeResponse.result?.exceptionDetails) {
    throw new Error(
      disposeResponse.result.exceptionDetails.exception?.description ||
        disposeResponse.result.exceptionDetails.text
    );
  }

  const disposeResult = disposeResponse.result?.result?.value;

  if (
    !disposeResult ||
    disposeResult.error ||
    disposeResult.stderr ||
    disposeResult.data !== true
  ) {
    throw new Error(
      `Could not dispose packaged MTP session: ${JSON.stringify(
        disposeResponse
      )}`
    );
  }

  socket.close();
  console.log(
    'Packaged device E2E passed:',
    JSON.stringify({ ...result, screenshotPath })
  );
})()
  .catch(async (error) => {
    let cleanupErrors = [];

    if (cleanupRemoteRoots) {
      try {
        cleanupErrors = await cleanupRemoteRoots([remoteRoot, uiRemoteRoot]);
      } catch (cleanupError) {
        cleanupErrors = [
          `cleanup exception: ${cleanupError.stack || cleanupError}`,
        ];
      }
    }

    console.error(error.stack || error);
    if (cleanupErrors.length > 0) {
      console.error(`Cleanup: ${cleanupErrors.join('; ')}`);
    }

    console.error(appLogs.join('').slice(-4000));
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(timeout);
    await stopChild();
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });
