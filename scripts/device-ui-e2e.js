/* eslint-disable no-console, no-await-in-loop, promise/catch-or-return */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { app } = require('electron');

if (process.env.NEOMTP_DEVICE_E2E !== 'true') {
  throw new Error(
    'Refusing to run the device UI E2E without NEOMTP_DEVICE_E2E=true'
  );
}

if (process.platform !== 'darwin') {
  throw new Error('The device UI E2E currently supports macOS only');
}

const root = path.resolve(__dirname, '..');
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'neomtp-device-ui-e2e-')
);
const temporaryHome = path.join(temporaryRoot, 'home');
const fixtureRoot = path.join(temporaryHome, 'fixtures');
const downloadRoot = path.join(temporaryHome, 'downloads');
const nativeOutput = path.join(temporaryRoot, 'native');
const nativeLibrary = path.join(nativeOutput, 'kalam.dylib');
const screenshotPath = path.join(os.tmpdir(), 'neomtp-device-ui-e2e.png');
const failureScreenshotPath = path.join(
  os.tmpdir(),
  'neomtp-device-ui-e2e-failure.png'
);
const remoteName = `NeoMTP-UI-E2E-${crypto.randomUUID()}`;
const remoteRoot = `/${remoteName}`;
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

fs.mkdirSync(downloadRoot, { recursive: true });
fs.mkdirSync(nativeOutput, { recursive: true });

const fixtures = {
  single: writeFixture('single.bin', Buffer.alloc(3 * 1024 * 1024 + 17, 0x5a)),
  multiA: writeFixture(
    'multi-a.txt',
    'NeoMTP click-driven multiple-file E2E\n'.repeat(30000)
  ),
  multiB: writeFixture('multi-b.bin', Buffer.alloc(6 * 1024 * 1024 + 31, 0xa5)),
};

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
      GOCACHE: path.join(temporaryRoot, 'go-build-cache'),
    },
    stdio: 'inherit',
  }
);

process.env.HOME = temporaryHome;
process.env.NEOMTP_KALAM_LIB_PATH = nativeLibrary;

app.setPath('userData', path.join(temporaryRoot, 'chromium'));
app.disableHardwareAcceleration();

let mainWindow = null;
let cleanedUp = false;
let startupTimeout = null;
const rendererErrors = [];

const cleanup = () => {
  if (cleanedUp) {
    return;
  }

  cleanedUp = true;

  if (startupTimeout) {
    clearTimeout(startupTimeout);
  }

  fs.rmSync(temporaryRoot, { recursive: true, force: true });
};

process.once('exit', cleanup);

startupTimeout = setTimeout(() => {
  console.error(
    `Timed out running the click-driven device E2E${
      rendererErrors.length ? `: ${rendererErrors.join('; ')}` : ''
    }`
  );
  app.exit(1);
}, 240000);

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
    if (/uncaught|unhandled|typeerror|referenceerror/iu.test(message)) {
      rendererErrors.push(message);
    }
  });
});

require(path.join(root, 'app/main.prod.js'));

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const waitFor = async (label, predicate, timeout = 30000) => {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeout) {
    try {
      const result = await predicate();

      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }

    await wait(100);
  }

  throw new Error(
    `Timed out waiting for ${label}${lastError ? `: ${lastError}` : ''}`
  );
};

const waitForMaybe = async (predicate, timeout) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    if (await predicate()) {
      return true;
    }

    await wait(100);
  }

  return false;
};

const installDomDriver = () => {
  const state = {
    progressTitles: [],
    snackbarMessages: [],
    keyEvents: [],
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
      image.closest('label')?.parentElement;
    const checkbox = rootElement?.querySelector('input[type="checkbox"]');

    return {
      image,
      root: rootElement,
      checkbox,
      checkboxTarget: checkbox?.closest('.MuiButtonBase-root') || checkbox,
      openTarget: rootElement?.matches('tr')
        ? rootElement.querySelector('.nameCell')
        : rootElement,
    };
  };
  const visibleDialogs = () =>
    [...document.querySelectorAll('[role="dialog"]')].filter(visible);
  const recordProgressElement = (element) => {
    const title = element.textContent.match(
      /Copying files to (?:Phone|Computer)\.\.\./
    )?.[0];

    if (title && !state.progressTitles.includes(title)) {
      state.progressTitles.push(title);
    }
  };
  const scan = () => {
    visibleDialogs().forEach((dialog) => {
      recordProgressElement(dialog);
    });

    const snackbar = document.querySelector('#client-snackbar');
    const message = visible(snackbar) ? snackbar.textContent.trim() : '';

    if (message && !state.snackbarMessages.includes(message)) {
      state.snackbarMessages.push(message);
    }
  };
  const observer = new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        recordProgressElement(node);
      });
    });
    scan();
  });

  document.addEventListener(
    'keydown',
    (event) => {
      state.keyEvents.push({
        key: event.key,
        code: event.code,
        keyCode: event.keyCode,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      });
      state.keyEvents = state.keyEvents.slice(-20);
    },
    true
  );

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });
  scan();

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

    return {
      x,
      y,
    };
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
      case 'pane':
        target = pane(spec.deviceType);
        break;
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

  window.__neomtpUiE2e = {
    rect,
    resetTransferObservations() {
      state.progressTitles = [];
      state.snackbarMessages = [];
      scan();
    },
    snapshot() {
      scan();

      const dialogs = visibleDialogs();
      const progressDialog = dialogs.find((dialog) =>
        /(?:Copying files to (?:Phone|Computer)|Transferring files)\.\.\./.test(
          dialog.innerText
        )
      );
      const confirmDialog = dialogs.find(
        (dialog) =>
          dialog.getAttribute('aria-labelledby') === 'confirm-dialogbox'
      );
      const clipboardMatch = document.body.innerText.match(
        /(\d+) items? in clipboard/
      );

      return {
        local: paneState('local'),
        mtp: paneState('mtp'),
        activeElementId: document.activeElement?.id || '',
        title: document.querySelector('#app-main-titlebar')?.innerText || '',
        clipboardCount: Number(clipboardMatch?.[1] || 0),
        dialogs: dialogs.map((dialog) => dialog.innerText),
        confirmText: confirmDialog?.innerText || '',
        progressVisible: Boolean(progressDialog),
        progressTitles: [...state.progressTitles],
        snackbarMessages: [...state.snackbarMessages],
        keyEvents: [...state.keyEvents],
        newFolderValue:
          document.querySelector('#newFolderDialog')?.value || null,
      };
    },
  };

  return true;
};

const execute = (expression) =>
  mainWindow.webContents.executeJavaScript(expression, true);

const domCall = (method, ...args) =>
  execute(
    `window.__neomtpUiE2e.${method}(${args
      .map((argument) => JSON.stringify(argument))
      .join(',')})`
  );

const snapshot = () => domCall('snapshot');

const physicalClick = async (spec, modifiers = []) => {
  let point = null;

  await waitFor(
    `click target ${JSON.stringify(spec)}`,
    async () => {
      point = await domCall('rect', spec);

      return Boolean(point);
    },
    5000
  );

  if (!point) {
    throw new Error(`Could not locate click target: ${JSON.stringify(spec)}`);
  }

  app.focus({ steal: true });
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.focus();
  mainWindow.webContents.sendInputEvent({
    type: 'mouseMove',
    x: point.x,
    y: point.y,
    modifiers,
  });
  mainWindow.webContents.sendInputEvent({
    type: 'mouseDown',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
    modifiers,
  });
  mainWindow.webContents.sendInputEvent({
    type: 'mouseUp',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
    modifiers,
  });
  await wait(100);
};

const physicalDoubleClick = async (spec) => {
  let point = null;

  await waitFor(
    `double-click target ${JSON.stringify(spec)}`,
    async () => {
      point = await domCall('rect', spec);

      return Boolean(point);
    },
    5000
  );

  if (!point) {
    throw new Error(
      `Could not locate double-click target: ${JSON.stringify(spec)}`
    );
  }

  app.focus({ steal: true });
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.focus();

  for (const clickCount of [1, 2]) {
    mainWindow.webContents.sendInputEvent({
      type: 'mouseDown',
      x: point.x,
      y: point.y,
      button: 'left',
      clickCount,
    });
    mainWindow.webContents.sendInputEvent({
      type: 'mouseUp',
      x: point.x,
      y: point.y,
      button: 'left',
      clickCount,
    });
    await wait(75);
  }
};

const keyDown = (keyCode, modifiers = []) => {
  mainWindow.webContents.sendInputEvent({
    type: 'keyDown',
    keyCode,
    modifiers,
  });
};

const keyUp = (keyCode, modifiers = []) => {
  mainWindow.webContents.sendInputEvent({
    type: 'keyUp',
    keyCode,
    modifiers,
  });
};

const commandShortcut = async (keyCode) => {
  app.focus({ steal: true });
  mainWindow.show();
  mainWindow.focus();
  keyDown(keyCode.toLowerCase(), ['meta']);
  keyUp(keyCode.toLowerCase(), ['meta']);
  await wait(150);
};

const focusPane = async (deviceType) => {
  await physicalClick({ kind: 'breadcrumbLast', deviceType });
  await waitFor(
    `${deviceType} pane focus`,
    async () =>
      (await snapshot()).activeElementId ===
      `file-explorer-body-wrapper-${deviceType}`
  );
};

const waitForPaneItems = async (deviceType, names, timeout = 30000) =>
  waitFor(
    `${deviceType} items ${names.join(', ')}`,
    async () => {
      const state = await snapshot();

      return names.every((name) => state[deviceType].items.includes(name));
    },
    timeout
  );

const waitForBreadcrumb = async (deviceType, name) =>
  waitFor(`${deviceType} breadcrumb ${name}`, async () => {
    const state = await snapshot();
    const { breadcrumbs } = state[deviceType];

    return breadcrumbs[breadcrumbs.length - 1] === name;
  });

const selectItems = async (deviceType, names) => {
  for (let index = 0; index < names.length; index += 1) {
    await physicalClick({
      kind: 'itemCheckbox',
      deviceType,
      name: names[index],
    });

    await waitFor(
      `${deviceType} selection ${names.slice(0, index + 1).join(', ')}`,
      async () => {
        const { selected } = (await snapshot())[deviceType];

        return (
          selected.length === index + 1 &&
          names.slice(0, index + 1).every((name) => selected.includes(name))
        );
      }
    );
  }
};

const copySelection = async (deviceType, expectedCount) => {
  await focusPane(deviceType);
  await commandShortcut('C');
  await waitFor(`${expectedCount}-item clipboard`, async () => {
    const state = await snapshot();

    return (
      state.clipboardCount === expectedCount &&
      state[deviceType].selected.length === 0
    );
  });
};

const pasteAndWait = async ({ deviceType, names, title }) => {
  await focusPane(deviceType);
  await domCall('resetTransferObservations');
  await commandShortcut('V');
  try {
    await waitFor(
      `${title} and destination listing`,
      async () => {
        const state = await snapshot();

        if (state.confirmText.includes('Replace and merge')) {
          throw new Error(
            `Unexpected overwrite confirmation: ${state.confirmText}`
          );
        }

        if (state.snackbarMessages.length > 0) {
          throw new Error(
            `Transfer snackbar error: ${state.snackbarMessages.join('; ')}`
          );
        }

        return (
          state.progressTitles.includes(title) &&
          !state.progressVisible &&
          state.clipboardCount === 0 &&
          names.every((name) => state[deviceType].items.includes(name))
        );
      },
      90000
    );
  } catch (error) {
    const state = await snapshot();

    throw new Error(
      `${error.message}; transfer state: ${JSON.stringify({
        destinationItems: state[deviceType].items,
        clipboardCount: state.clipboardCount,
        progressVisible: state.progressVisible,
        progressTitles: state.progressTitles,
        snackbarMessages: state.snackbarMessages,
        keyEvents: state.keyEvents,
      })}`
    );
  }
};

const digest = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const requireSameFile = (source, downloaded) => {
  if (!fs.existsSync(downloaded)) {
    throw new Error(`Downloaded file does not exist: ${downloaded}`);
  }

  if (digest(source) !== digest(downloaded)) {
    throw new Error(`Downloaded file differs from source: ${downloaded}`);
  }
};

const captureScreenshot = async (targetPath) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  const image = await mainWindow.webContents.capturePage();

  fs.writeFileSync(targetPath, image.toPNG());
};

const fallbackCleanup = async () =>
  execute(`(async () => {
    const api = window.neomtp;
    const errors = [];
    let storagesResponse = await api.fileExplorer.listStorages({ deviceType: 'mtp' });

    if (storagesResponse?.error || storagesResponse?.stderr) {
      const initializeResponse = await api.fileExplorer.initialize({ deviceType: 'mtp' });

      if (initializeResponse?.error || initializeResponse?.stderr) {
        errors.push('initialize: ' + JSON.stringify(initializeResponse));
      }

      storagesResponse = await api.fileExplorer.listStorages({ deviceType: 'mtp' });
    }

    const storageIds = Object.keys(storagesResponse?.data || {});

    if (storageIds.length > 0) {
      for (const rawStorageId of storageIds) {
        const storageId = Number(rawStorageId);
        const exists = await api.fileExplorer.filesExist({
          deviceType: 'mtp',
          fileList: [${JSON.stringify(remoteRoot)}],
          storageId,
        });

        if (exists) {
          const deleteResponse = await api.fileExplorer.deleteFiles({
            deviceType: 'mtp',
            fileList: [${JSON.stringify(remoteRoot)}],
            storageId,
          });

          if (deleteResponse?.error || deleteResponse?.stderr || deleteResponse?.data !== true) {
            errors.push('delete: ' + JSON.stringify(deleteResponse));
          } else if (await api.fileExplorer.filesExist({
            deviceType: 'mtp',
            fileList: [${JSON.stringify(remoteRoot)}],
            storageId,
          })) {
            errors.push('cleanup verification failed for storage ' + storageId);
          }
        }
      }
    } else {
      errors.push('no storage available for cleanup verification');
    }

    const disposeResponse = await api.fileExplorer.dispose({ deviceType: 'mtp' });

    if (disposeResponse?.error || disposeResponse?.stderr) {
      errors.push('dispose: ' + JSON.stringify(disposeResponse));
    }

    return errors;
  })()`);

const runUiWorkflow = async () => {
  await waitFor('main window', () => mainWindow && !mainWindow.isDestroyed());
  await waitFor(
    'renderer URL',
    () => mainWindow.webContents.getURL().length > 0
  );
  mainWindow.webContents.setIgnoreMenuShortcuts(true);
  await waitFor('preload and React root', () =>
    execute(
      `Boolean(window.neomtp && document.querySelector('#root')?.children.length)`
    )
  );

  await execute(`(${installDomDriver.toString()})()`);
  await waitForPaneItems('local', ['fixtures', 'downloads']);

  let connected = await waitForMaybe(async () => {
    const state = await snapshot();

    return (
      state.mtp.items.length > 0 && !state.mtp.text.includes('not connected')
    );
  }, 20000);

  if (!connected) {
    await physicalClick({
      kind: 'toolbar',
      deviceType: 'mtp',
      label: 'Refresh',
    });
    connected = await waitForMaybe(async () => {
      const state = await snapshot();

      return (
        state.mtp.items.length > 0 && !state.mtp.text.includes('not connected')
      );
    }, 30000);
  }

  if (!connected) {
    throw new Error(
      `Phone pane did not connect: ${JSON.stringify(await snapshot())}`
    );
  }

  await physicalClick({
    kind: 'toolbar',
    deviceType: 'mtp',
    label: 'Storage',
  });
  await waitFor('storage selection dialog', async () =>
    (
      await snapshot()
    ).dialogs.some((dialog) => dialog.includes('Select Storage Option'))
  );
  await physicalClick({
    kind: 'dialogOption',
    dialogText: 'Select Storage Option',
    index: 0,
  });
  await waitFor('storage selection and phone root listing', async () => {
    const state = await snapshot();

    return (
      !state.dialogs.some((dialog) =>
        dialog.includes('Select Storage Option')
      ) &&
      state.mtp.items.length > 0 &&
      state.mtp.breadcrumbs[state.mtp.breadcrumbs.length - 1] === 'Root'
    );
  });

  if ((await snapshot()).mtp.items.includes(remoteName)) {
    throw new Error(`Refusing to reuse phone path ${remoteRoot}`);
  }

  await focusPane('mtp');
  await commandShortcut('N');
  await wait(500);

  const newFolderShortcutState = await snapshot();

  if (
    !newFolderShortcutState.dialogs.some((dialog) =>
      dialog.includes('Create a new folder')
    )
  ) {
    throw new Error(
      `New-folder shortcut was not handled: ${JSON.stringify({
        isWindowFocused: mainWindow.isFocused(),
        activeElementId: newFolderShortcutState.activeElementId,
        keyEvents: newFolderShortcutState.keyEvents,
      })}`
    );
  }

  await waitFor('new-folder dialog', async () =>
    (
      await snapshot()
    ).dialogs.some((dialog) => dialog.includes('Create a new folder'))
  );
  await physicalClick({ kind: 'input', id: 'newFolderDialog' });
  mainWindow.webContents.insertText(remoteName);
  await waitFor(
    'new-folder text entry',
    async () => (await snapshot()).newFolderValue === remoteName
  );
  await physicalClick({
    kind: 'dialogButton',
    dialogText: 'Create a new folder',
    text: 'Create',
  });
  await waitForPaneItems('mtp', [remoteName], 30000);
  await physicalDoubleClick({
    kind: 'itemOpen',
    deviceType: 'mtp',
    name: remoteName,
  });
  await waitForBreadcrumb('mtp', remoteName);

  await physicalDoubleClick({
    kind: 'itemOpen',
    deviceType: 'local',
    name: 'fixtures',
  });
  await waitForBreadcrumb('local', 'fixtures');
  await waitForPaneItems('local', ['single.bin', 'multi-a.txt', 'multi-b.bin']);

  await selectItems('local', ['single.bin']);
  await copySelection('local', 1);
  await pasteAndWait({
    deviceType: 'mtp',
    names: ['single.bin'],
    title: 'Copying files to Phone...',
  });

  await selectItems('local', ['multi-a.txt', 'multi-b.bin']);
  await copySelection('local', 2);
  await pasteAndWait({
    deviceType: 'mtp',
    names: ['multi-a.txt', 'multi-b.bin'],
    title: 'Copying files to Phone...',
  });

  await physicalClick({
    kind: 'toolbar',
    deviceType: 'local',
    label: 'Folder Up',
  });
  await waitForPaneItems('local', ['downloads']);
  await physicalDoubleClick({
    kind: 'itemOpen',
    deviceType: 'local',
    name: 'downloads',
  });
  await waitForBreadcrumb('local', 'downloads');

  await selectItems('mtp', ['single.bin']);
  await copySelection('mtp', 1);
  await pasteAndWait({
    deviceType: 'local',
    names: ['single.bin'],
    title: 'Copying files to Computer...',
  });

  await selectItems('mtp', ['multi-a.txt', 'multi-b.bin']);
  await copySelection('mtp', 2);
  await pasteAndWait({
    deviceType: 'local',
    names: ['multi-a.txt', 'multi-b.bin'],
    title: 'Copying files to Computer...',
  });

  requireSameFile(fixtures.single, path.join(downloadRoot, 'single.bin'));
  requireSameFile(fixtures.multiA, path.join(downloadRoot, 'multi-a.txt'));
  requireSameFile(fixtures.multiB, path.join(downloadRoot, 'multi-b.bin'));

  await captureScreenshot(screenshotPath);

  await physicalClick({
    kind: 'breadcrumb',
    deviceType: 'mtp',
    text: 'Root',
  });
  await waitForBreadcrumb('mtp', 'Root');
  await waitForPaneItems('mtp', [remoteName]);
  await selectItems('mtp', [remoteName]);
  await physicalClick({
    kind: 'toolbar',
    deviceType: 'mtp',
    label: 'Delete',
  });
  await waitFor('phone delete confirmation', async () =>
    (
      await snapshot()
    ).confirmText.includes('permanently delete the items from your Phone')
  );
  await physicalClick({
    kind: 'dialogButton',
    dialogText: 'permanently delete the items from your Phone',
    text: 'Yes',
  });
  await waitFor(
    'phone sandbox deletion',
    async () => !(await snapshot()).mtp.items.includes(remoteName)
  );

  const remoteDeleteVerification = await execute(`(async () => {
    const api = window.neomtp;
    const storages = await api.fileExplorer.listStorages({ deviceType: 'mtp' });

    if (storages?.error || storages?.stderr) {
      return { error: 'list storages: ' + JSON.stringify(storages) };
    }

    for (const rawStorageId of Object.keys(storages?.data || {})) {
      const storageId = Number(rawStorageId);
      const exists = await api.fileExplorer.filesExist({
        deviceType: 'mtp',
        fileList: [${JSON.stringify(remoteRoot)}],
        storageId,
      });

      if (exists) {
        return { error: null, exists: true, storageId };
      }
    }

    return { error: null, exists: false };
  })()`);

  if (remoteDeleteVerification.error || remoteDeleteVerification.exists) {
    throw new Error(
      `Phone delete was not verified through MTP: ${JSON.stringify(
        remoteDeleteVerification
      )}`
    );
  }

  const finalState = await snapshot();

  return {
    deviceTitle: finalState.title,
    uploaded: ['single.bin', 'multi-a.txt', 'multi-b.bin'],
    downloaded: ['single.bin', 'multi-a.txt', 'multi-b.bin'],
    remoteCleanupVerified: !finalState.mtp.items.includes(remoteName),
    screenshotPath,
  };
};

const run = async () => {
  let result = null;
  let workflowError = null;

  try {
    result = await runUiWorkflow();
  } catch (error) {
    workflowError = error;

    try {
      await captureScreenshot(failureScreenshotPath);
    } catch (screenshotError) {
      rendererErrors.push(`failure screenshot: ${screenshotError}`);
    }
  }

  const cleanupErrors = await fallbackCleanup();

  if (workflowError || cleanupErrors.length > 0 || rendererErrors.length > 0) {
    throw new Error(
      [
        workflowError ? workflowError.stack || workflowError : null,
        cleanupErrors.length ? `cleanup: ${cleanupErrors.join('; ')}` : null,
        rendererErrors.length ? `renderer: ${rendererErrors.join('; ')}` : null,
        workflowError ? `failure screenshot: ${failureScreenshotPath}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  console.log('Click-driven device UI E2E passed:', JSON.stringify(result));
};

app
  .whenReady()
  .then(run)
  .then(() => {
    clearTimeout(startupTimeout);

    const quitTimeout = setTimeout(() => {
      console.error('Timed out waiting for Electron to quit after UI E2E');
      app.exit(1);
    }, 5000);

    app.once('will-quit', () => clearTimeout(quitTimeout));
    app.quit();

    return null;
  })
  .catch((error) => {
    console.error(error.stack || error);
    app.exit(1);
  });
