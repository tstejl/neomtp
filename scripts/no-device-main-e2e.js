/* eslint-disable no-console, no-await-in-loop, promise/catch-or-return */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app } = require('electron');
const macPermissions = require('node-mac-permissions');

const root = path.resolve(__dirname, '..');
const temporaryUserData = fs.mkdtempSync(
  path.join(os.tmpdir(), 'neomtp-main-no-device-e2e-')
);
const temporaryHome = path.join(temporaryUserData, 'home');
const temporaryDownloads = path.join(temporaryHome, 'Downloads');
const protectedFolderFixtureName = 'neomtp-protected-folder-fixture.txt';
const originalAskForFoldersAccess = macPermissions.askForFoldersAccess;
const folderPermissionRequests = [];
const marqueeScreenshotPath = path.join(
  os.tmpdir(),
  'neomtp-no-device-marquee-e2e.png'
);

fs.mkdirSync(temporaryDownloads, { recursive: true });
fs.writeFileSync(
  path.join(temporaryDownloads, protectedFolderFixtureName),
  'NeoMTP protected-folder permission fixture\n'
);
const marqueeFixtures = [
  {
    relativePath: 'neomtp-marquee-alpha.txt',
    contents: 'NeoMTP drag-marquee fixture alpha\n',
  },
  {
    relativePath: 'neomtp-marquee-beta.txt',
    contents: 'NeoMTP drag-marquee fixture beta\n',
  },
  {
    relativePath: 'neomtp-marquee-gamma.txt',
    contents: 'NeoMTP drag-marquee fixture gamma\n',
  },
  {
    relativePath: 'neomtp-marquee-folder',
    directory: true,
  },
];

marqueeFixtures.forEach((fixture) => {
  const fixturePath = path.join(temporaryHome, fixture.relativePath);

  if (fixture.directory) {
    fs.mkdirSync(fixturePath, { recursive: true });
    fs.writeFileSync(
      path.join(fixturePath, 'nested-fixture.txt'),
      'NeoMTP nested drag-marquee fixture\n'
    );
  } else {
    fs.writeFileSync(fixturePath, fixture.contents);
  }
});

const marqueeTargetPaths = marqueeFixtures.map(({ relativePath }) =>
  path.join(temporaryHome, relativePath)
);

process.env.HOME = temporaryHome;
process.env.NEOMTP_NO_DEVICE_E2E = 'true';

macPermissions.askForFoldersAccess = async (folder) => {
  folderPermissionRequests.push(folder);

  return 'authorized';
};

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
  macPermissions.askForFoldersAccess = originalAskForFoldersAccess;
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
      const protectedFolderFiles = await api.fileExplorer.listFiles({
        deviceType: 'local',
        filePath: `${api.app.getPaths().homeDir}/Downloads`,
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
        protectedFolderFiles: protectedFolderFiles?.data,
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

  if (
    !Array.isArray(result.protectedFolderFiles) ||
    !result.protectedFolderFiles.some(
      ({ name }) => name === protectedFolderFixtureName
    ) ||
    !folderPermissionRequests.includes('downloads')
  ) {
    throw new Error(
      `Compiled main-process permission flow failed: ${JSON.stringify({
        protectedFolderFiles: result.protectedFolderFiles,
        folderPermissionRequests,
      })}`
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

  const execute = (source) =>
    mainWindow.webContents.executeJavaScript(source, true);

  app.focus({ steal: true });
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.focus();
  await wait(100);

  const freshInstallDialogOpen = await execute(
    `Boolean(document.querySelector('[role="dialog"]'))`
  );

  if (freshInstallDialogOpen) {
    mainWindow.webContents.sendInputEvent({
      type: 'keyDown',
      keyCode: 'Escape',
    });
    mainWindow.webContents.sendInputEvent({
      type: 'keyUp',
      keyCode: 'Escape',
    });
    await waitFor(
      async () =>
        !(await execute(`Boolean(document.querySelector('[role="dialog"]'))`)),
      5000
    );
  }

  await waitFor(
    async () =>
      !(await execute(
        `Boolean(document.querySelector('.MuiDialog-container'))`
      )),
    5000
  );

  const targetPathsJson = JSON.stringify(marqueeTargetPaths);
  let lastMarqueeState = null;
  let activeMarqueeState = null;
  let dragLayout = null;
  const readMarqueeState = async () => {
    lastMarqueeState = await execute(
      `(${(targetPaths) => {
        const pane = document.querySelector(
          '#file-explorer-body-wrapper-local'
        );
        const entries = pane
          ? [...pane.querySelectorAll('[data-file-entry]')]
          : [];
        const visible = (element) => {
          if (!element || element.getClientRects().length === 0) {
            return false;
          }

          const style = getComputedStyle(element);

          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
          );
        };
        const pathForEntry = (entry) =>
          entry.getAttribute('data-file-path') ||
          entry
            .querySelector('[data-file-path]')
            ?.getAttribute('data-file-path') ||
          null;
        const checkboxForEntry = (entry) =>
          entry.querySelector('input[type="checkbox"], [role="checkbox"]');
        const checkboxIsChecked = (checkbox) =>
          Boolean(
            checkbox?.checked ||
              checkbox?.getAttribute('aria-checked') === 'true'
          );
        const describeEntry = (entry) => {
          const rect = entry.getBoundingClientRect();
          const checkbox = checkboxForEntry(entry);

          return {
            path: pathForEntry(entry),
            visible: visible(entry),
            checkboxFound: Boolean(checkbox),
            checked: checkboxIsChecked(checkbox),
            rect: {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
            },
          };
        };
        const targetEntries = entries.filter((entry) =>
          targetPaths.includes(pathForEntry(entry))
        );
        const marqueeElement = document.querySelector(
          '[data-marquee-selection-box]'
        );
        const marqueeRect = marqueeElement?.getBoundingClientRect();
        const marqueeStyle = marqueeElement
          ? getComputedStyle(marqueeElement)
          : null;

        return {
          panePresent: Boolean(pane),
          gridView:
            targetEntries.length > 0 &&
            targetEntries.every(
              (entry) => !entry.closest('tr[role="checkbox"]')
            ),
          entries: entries.map(describeEntry),
          targets: targetEntries.map(describeEntry),
          checkedPaths: entries
            .filter((entry) => checkboxIsChecked(checkboxForEntry(entry)))
            .map(pathForEntry),
          marqueeVisible: visible(marqueeElement),
          marqueeRect: marqueeRect
            ? {
                left: marqueeRect.left,
                top: marqueeRect.top,
                right: marqueeRect.right,
                bottom: marqueeRect.bottom,
                width: marqueeRect.width,
                height: marqueeRect.height,
              }
            : null,
          marqueeStyle: marqueeStyle
            ? {
                position: marqueeStyle.position,
                zIndex: marqueeStyle.zIndex,
                backgroundColor: marqueeStyle.backgroundColor,
                borderColor: marqueeStyle.borderColor,
                opacity: marqueeStyle.opacity,
              }
            : null,
        };
      }})(${targetPathsJson})`
    );

    return lastMarqueeState;
  };
  const waitForMarquee = async (label, predicate, timeout = 20000) => {
    try {
      await waitFor(async () => predicate(await readMarqueeState()), timeout);
    } catch (error) {
      throw new Error(
        `${label}: ${error.message}; last state: ${JSON.stringify(
          lastMarqueeState
        )}; drag layout: ${JSON.stringify(dragLayout)}`
      );
    }
  };

  await waitForMarquee(
    'local marquee fixture entries',
    (state) =>
      state.panePresent &&
      state.gridView &&
      state.targets.length === marqueeTargetPaths.length &&
      state.targets.every(
        (target) =>
          target.visible &&
          target.checkboxFound &&
          target.rect.width > 0 &&
          target.rect.height > 0
      )
  );

  await waitFor(
    () =>
      execute(
        `(${() => {
          const pane = document.querySelector(
            '#file-explorer-body-wrapper-local'
          );
          const entry = pane?.querySelector('[data-file-entry]');
          const rect = entry?.getBoundingClientRect();
          const hit = rect
            ? document.elementFromPoint(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2
              )
            : null;

          return Boolean(entry && hit && entry.contains(hit));
        }})()`
      ),
    10000
  );

  dragLayout = await execute(
    `(${(targetPaths) => {
      const pane = document.querySelector('#file-explorer-body-wrapper-local');
      const entries = pane
        ? [...pane.querySelectorAll('[data-file-entry]')]
        : [];
      const pathForEntry = (entry) =>
        entry.getAttribute('data-file-path') ||
        entry
          .querySelector('[data-file-path]')
          ?.getAttribute('data-file-path') ||
        null;
      const rectFor = (element) => {
        const rect = element.getBoundingClientRect();

        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const entryRects = entries
        .map((entry) => ({ path: pathForEntry(entry), rect: rectFor(entry) }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0);
      const targetRects = entryRects.filter(({ path }) =>
        targetPaths.includes(path)
      );
      const paneRect = pane ? rectFor(pane) : null;
      const sampleAxis = (start, end, count = 18) => {
        if (end - start < 16) {
          return [(start + end) / 2];
        }

        return Array.from(
          { length: count },
          (_, index) => start + 8 + ((end - start - 16) * index) / (count - 1)
        );
      };
      const pointIsEmpty = (x, y) => {
        const hit = document.elementFromPoint(x, y);

        return Boolean(
          hit &&
            pane?.contains(hit) &&
            !hit.closest('[data-file-entry]') &&
            !hit.closest(
              'input,button,a,select,textarea,[role="button"],thead,th,[contenteditable="true"]'
            )
        );
      };
      const emptyPoints = [];

      if (paneRect) {
        sampleAxis(paneRect.left, paneRect.right).forEach((x) => {
          sampleAxis(paneRect.top, paneRect.bottom).forEach((y) => {
            if (pointIsEmpty(x, y)) {
              emptyPoints.push({ x, y });
            }
          });
        });
      }

      const intersects = (start, end, rect) => {
        const left = Math.min(start.x, end.x);
        const right = Math.max(start.x, end.x);
        const top = Math.min(start.y, end.y);
        const bottom = Math.max(start.y, end.y);

        return (
          rect.left <= right &&
          rect.right >= left &&
          rect.top <= bottom &&
          rect.bottom >= top
        );
      };
      let bestDrag = null;

      emptyPoints.forEach((start) => {
        emptyPoints.forEach((end) => {
          const distance = Math.hypot(end.x - start.x, end.y - start.y);

          if (distance < 24) {
            return;
          }

          const coveredPaths = entryRects
            .filter(({ rect }) => intersects(start, end, rect))
            .map(({ path }) => path);
          const coversExactlyTargets =
            coveredPaths.length === targetPaths.length &&
            targetPaths.every((filePath) => coveredPaths.includes(filePath));

          if (!coversExactlyTargets) {
            return;
          }

          const area = Math.abs((end.x - start.x) * (end.y - start.y));

          if (!bestDrag || area > bestDrag.area) {
            bestDrag = {
              start: { x: Math.round(start.x), y: Math.round(start.y) },
              end: { x: Math.round(end.x), y: Math.round(end.y) },
              coveredPaths,
              area,
            };
          }
        });
      });

      return {
        paneRect: pane ? rectFor(pane) : null,
        targetRects,
        emptyPointCount: emptyPoints.length,
        drag: bestDrag,
      };
    }})(${targetPathsJson})`
  );

  if (
    !dragLayout.drag ||
    dragLayout.drag.coveredPaths.length !== marqueeTargetPaths.length ||
    dragLayout.emptyPointCount < 2
  ) {
    throw new Error(
      `Could not discover a robust local drag-marquee path: ${JSON.stringify(
        dragLayout
      )}`
    );
  }

  const hasExactMarqueeSelection = (state) =>
    state.checkedPaths.length === dragLayout.drag.coveredPaths.length &&
    dragLayout.drag.coveredPaths.every((filePath) =>
      state.checkedPaths.includes(filePath)
    );

  await mainWindow.webContents.sendInputEvent({
    type: 'mouseMove',
    x: dragLayout.drag.start.x,
    y: dragLayout.drag.start.y,
  });
  await mainWindow.webContents.sendInputEvent({
    type: 'mouseDown',
    x: dragLayout.drag.start.x,
    y: dragLayout.drag.start.y,
    button: 'left',
    clickCount: 1,
  });
  await wait(100);
  await mainWindow.webContents.sendInputEvent({
    type: 'mouseMove',
    x: dragLayout.drag.end.x,
    y: dragLayout.drag.end.y,
  });

  await waitForMarquee(
    'drag-marquee selection',
    (state) => state.marqueeVisible && hasExactMarqueeSelection(state),
    10000
  );

  activeMarqueeState = await readMarqueeState();

  if (
    !activeMarqueeState.marqueeRect ||
    activeMarqueeState.marqueeRect.width < 4 ||
    activeMarqueeState.marqueeRect.height < 4 ||
    activeMarqueeState.marqueeRect.left < dragLayout.paneRect.left ||
    activeMarqueeState.marqueeRect.top < dragLayout.paneRect.top ||
    activeMarqueeState.marqueeRect.right > dragLayout.paneRect.right ||
    activeMarqueeState.marqueeRect.bottom > dragLayout.paneRect.bottom
  ) {
    throw new Error(
      `The active marquee has invalid geometry: ${JSON.stringify(
        activeMarqueeState
      )}`
    );
  }

  if (
    !activeMarqueeState.marqueeStyle?.backgroundColor.includes('0, 122, 245') ||
    !activeMarqueeState.marqueeStyle?.borderColor.includes('0, 122, 245')
  ) {
    throw new Error(
      `The active marquee does not use the visible NeoMTP selection color: ${JSON.stringify(
        activeMarqueeState.marqueeStyle
      )}`
    );
  }

  const marqueeScreenshot = await mainWindow.webContents.capturePage();

  fs.writeFileSync(marqueeScreenshotPath, marqueeScreenshot.toPNG());

  await mainWindow.webContents.sendInputEvent({
    type: 'mouseUp',
    x: dragLayout.drag.end.x,
    y: dragLayout.drag.end.y,
    button: 'left',
    clickCount: 1,
  });

  await waitForMarquee(
    'drag-marquee release',
    (state) => !state.marqueeVisible && hasExactMarqueeSelection(state),
    10000
  );

  const clearPoint = await execute(
    `(${(point) => {
      const pane = document.querySelector('#file-explorer-body-wrapper-local');
      const hit = document.elementFromPoint(point.x, point.y);

      return {
        empty: Boolean(
          hit &&
            pane?.contains(hit) &&
            !hit.closest('[data-file-entry]') &&
            !hit.closest(
              'input,button,a,select,textarea,[role="button"],thead,th,[contenteditable="true"]'
            )
        ),
        hit: hit?.tagName || null,
      };
    }})(${JSON.stringify(dragLayout.drag.start)})`
  );

  if (!clearPoint.empty) {
    throw new Error(
      `The verified marquee start point was no longer empty for clear-click: ${JSON.stringify(
        clearPoint
      )}`
    );
  }

  await mainWindow.webContents.sendInputEvent({
    type: 'mouseMove',
    x: dragLayout.drag.start.x,
    y: dragLayout.drag.start.y,
  });
  await mainWindow.webContents.sendInputEvent({
    type: 'mouseDown',
    x: dragLayout.drag.start.x,
    y: dragLayout.drag.start.y,
    button: 'left',
    clickCount: 1,
  });
  await mainWindow.webContents.sendInputEvent({
    type: 'mouseUp',
    x: dragLayout.drag.start.x,
    y: dragLayout.drag.start.y,
    button: 'left',
    clickCount: 1,
  });

  await waitForMarquee(
    'empty-space selection clear',
    (state) => !state.marqueeVisible && state.checkedPaths.length === 0,
    10000
  );

  console.log(
    'Actual main-process no-device E2E passed:',
    JSON.stringify({
      ...result,
      marquee: {
        targetPaths: dragLayout.drag.coveredPaths,
        start: dragLayout.drag.start,
        end: dragLayout.drag.end,
        screenshotPath: marqueeScreenshotPath,
        rect: activeMarqueeState.marqueeRect,
        style: activeMarqueeState.marqueeStyle,
      },
    })
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
