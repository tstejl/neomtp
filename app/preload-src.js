const { contextBridge, ipcRenderer, shell } = require('electron');

const channels = Object.freeze({
  openFaqsWindow: 'ipc.window.faqs',
  openHelpPhoneNotConnectingWindow: 'ipc.window.helpPhoneNotConnecting',
  openPrivacyPolicyWindow: 'ipc.window.privacyPolicy',
  openKeyboardShortcutsWindow: 'ipc.window.keyboardShortcuts',
  reportBugsDisposeMtp: 'ipc.reportBugsDisposeMtp',
  reportBugsDisposeMtpReply: 'ipc.reportBugsDisposeMtpReply',
  reportBugsDisposeMtpReplyFromMain: 'ipc.reportBugsDisposeMtpReply.fromMain',
  usbHotplug: 'ipc.usbHotplug',
  showContextMenu: 'ipc.contextMenu.show',
  getPath: 'ipc.app.getPath',
  windowReload: 'ipc.window.reload',
  windowMaximize: 'ipc.window.maximize',
  windowUnmaximize: 'ipc.window.unmaximize',
  windowIsMaximized: 'ipc.window.isMaximized',
  windowSetProgressBar: 'ipc.window.setProgressBar',
  settingsGetAll: 'ipc.settings.getAll',
  settingsGetItems: 'ipc.settings.getItems',
  settingsSetAll: 'ipc.settings.setAll',
  appGetPaths: 'ipc.app.getPaths',
  appGetCapabilities: 'ipc.app.getCapabilities',
  appCleanRotationFiles: 'ipc.app.cleanRotationFiles',
  systemIsProcessRunning: 'ipc.system.isProcessRunning',
  rendererLog: 'ipc.renderer.log',
  fileExplorerInitialize: 'ipc.fileExplorer.initialize',
  fileExplorerDispose: 'ipc.fileExplorer.dispose',
  fileExplorerListStorages: 'ipc.fileExplorer.listStorages',
  fileExplorerListFiles: 'ipc.fileExplorer.listFiles',
  fileExplorerRenameFile: 'ipc.fileExplorer.renameFile',
  fileExplorerDeleteFiles: 'ipc.fileExplorer.deleteFiles',
  fileExplorerMakeDirectory: 'ipc.fileExplorer.makeDirectory',
  fileExplorerFilesExist: 'ipc.fileExplorer.filesExist',
  fileExplorerTransferFiles: 'ipc.fileExplorer.transferFiles',
  fileExplorerTransferEvent: 'ipc.fileExplorer.transferEvent',
  fileExplorerFetchDebugReport: 'ipc.fileExplorer.fetchDebugReport',
  reportGetInfo: 'ipc.report.getInfo',
  reportCompressLog: 'ipc.report.compressLog',
  nativeThemeUpdated: 'nativeThemeUpdated',
  fileExplorerToolbarAction: 'fileExplorerToolbarActionCommunication',
  isFileTransferActiveSeek: 'isFileTransferActiveSeek',
  isFileTransferActiveReply: 'isFileTransferActiveReply',
  appUpdatesUpdateAvailableCommunication:
    'appUpdatesUpdateAvailableCommunication',
  appUpdatesUpdateAvailableReply: 'appUpdatesUpdateAvailableReply',
  appUpdatesProgressBarCommunication: 'appUpdatesProgressBarCommunication',
});

const allowedChannels = new Set(Object.values(channels));
const listenerWrappers = new Map();

const assertChannel = (channel) => {
  if (!allowedChannels.has(channel)) {
    throw new Error(`IPC channel is not allowlisted: ${channel}`);
  }
};

const assertListener = (listener) => {
  if (typeof listener !== 'function') {
    throw new TypeError('IPC listener must be a function');
  }
};

const addListener = (method, channel, listener) => {
  assertChannel(channel);
  assertListener(listener);

  const wrapper = (_event, ...args) => {
    if (method === 'once') {
      const remainingListeners = (listenerWrappers.get(channel) || []).filter(
        (entry) => entry.wrapper !== wrapper
      );

      if (remainingListeners.length > 0) {
        listenerWrappers.set(channel, remainingListeners);
      } else {
        listenerWrappers.delete(channel);
      }
    }

    return listener(null, ...args);
  };
  const channelListeners = listenerWrappers.get(channel) || [];

  channelListeners.push({ listener, wrapper });
  listenerWrappers.set(channel, channelListeners);
  ipcRenderer[method](channel, wrapper);

  return () => removeListener(channel, listener);
};

const removeListener = (channel, listener) => {
  assertChannel(channel);

  const channelListeners = listenerWrappers.get(channel) || [];
  const matchingListeners = channelListeners.filter(
    (entry) => entry.listener === listener
  );

  matchingListeners.forEach(({ wrapper }) => {
    ipcRenderer.removeListener(channel, wrapper);
  });

  const remainingListeners = channelListeners.filter(
    (entry) => entry.listener !== listener
  );

  if (remainingListeners.length > 0) {
    listenerWrappers.set(channel, remainingListeners);
  } else {
    listenerWrappers.delete(channel);
  }
};

const send = (channel, ...args) => {
  assertChannel(channel);
  ipcRenderer.send(channel, ...args);
};

const sendSync = (channel, ...args) => {
  assertChannel(channel);

  return ipcRenderer.sendSync(channel, ...args);
};

const invoke = (channel, ...args) => {
  assertChannel(channel);

  return ipcRenderer.invoke(channel, ...args);
};

const assertPlainObject = (value, message) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(message);
  }
};

const assertSettingsKeys = (keys) => {
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string')) {
    throw new TypeError('Settings keys must be an array of strings');
  }
};

let transferRequestId = 0;

const transferFiles = async (args = {}) => {
  assertPlainObject(args, 'File transfer arguments must be an object');

  const { onError, onPreprocess, onProgress, onCompleted, ...transferArgs } =
    args;

  [onError, onPreprocess, onProgress, onCompleted].forEach((callback) => {
    assertListener(callback);
  });

  transferRequestId += 1;
  const requestId = `${Date.now()}-${transferRequestId}`;
  let resolveTerminalEvent;
  let terminalEventReceived = false;
  const terminalEvent = new Promise((resolve) => {
    resolveTerminalEvent = resolve;
  });
  const settleTerminalEvent = (callback, payload) => {
    if (terminalEventReceived) {
      return;
    }

    terminalEventReceived = true;

    try {
      callback(payload);
    } finally {
      resolveTerminalEvent();
    }
  };

  const listener = (_event, event) => {
    if (!event || event.requestId !== requestId) {
      return;
    }

    switch (event.type) {
      case 'error':
        settleTerminalEvent(onError, event.payload);
        break;
      case 'preprocess':
        onPreprocess(event.payload);
        break;
      case 'progress':
        onProgress(event.payload);
        break;
      case 'completed':
        settleTerminalEvent(onCompleted, event.payload);
        break;
      default:
        break;
    }
  };

  ipcRenderer.on(channels.fileExplorerTransferEvent, listener);

  try {
    let response;

    try {
      response = await invoke(channels.fileExplorerTransferFiles, {
        ...transferArgs,
        requestId,
      });
    } catch (error) {
      settleTerminalEvent(onError, {
        error:
          error && typeof error.message === 'string'
            ? error.message
            : String(error),
        stderr: null,
        data: null,
      });

      throw error;
    }

    if (
      !terminalEventReceived &&
      (response === false ||
        response?.error ||
        response?.stderr ||
        response?.data === false)
    ) {
      settleTerminalEvent(onError, response);
    }

    await terminalEvent;

    return response;
  } finally {
    ipcRenderer.removeListener(channels.fileExplorerTransferEvent, listener);
  }
};

const sanitizeMenuItems = (items) => {
  if (!Array.isArray(items)) {
    throw new TypeError('Context menu items must be an array');
  }

  return items.map((item, id) => ({
    id,
    label: typeof item.label === 'string' ? item.label : '',
    enabled: item.enabled !== false,
  }));
};

contextBridge.exposeInMainWorld('openmtp', {
  ipc: {
    send,
    on: (channel, listener) => addListener('on', channel, listener),
    once: (channel, listener) => addListener('once', channel, listener),
    removeListener,
  },
  shell: {
    openExternal: (url) => {
      if (typeof url !== 'string') {
        throw new TypeError('External URL must be a string');
      }

      return shell.openExternal(url);
    },
    openPath: (filePath) => {
      if (typeof filePath !== 'string') {
        throw new TypeError('Path must be a string');
      }

      return shell.openPath(filePath);
    },
    showItemInFolder: (filePath) => {
      if (typeof filePath !== 'string') {
        throw new TypeError('Path must be a string');
      }

      return shell.showItemInFolder(filePath);
    },
  },
  window: {
    reload: () => send(channels.windowReload),
    maximize: () => send(channels.windowMaximize),
    unmaximize: () => send(channels.windowUnmaximize),
    isMaximized: () => sendSync(channels.windowIsMaximized),
    setProgressBar: (value) => send(channels.windowSetProgressBar, value),
  },
  app: {
    getPath: (name) => {
      if (typeof name !== 'string') {
        throw new TypeError('Path name must be a string');
      }

      return sendSync(channels.getPath, name);
    },
    getPaths: () => sendSync(channels.appGetPaths),
    getCapabilities: () => sendSync(channels.appGetCapabilities),
    cleanRotationFiles: () => invoke(channels.appCleanRotationFiles),
  },
  settings: {
    getAll: () => sendSync(channels.settingsGetAll),
    getItems: (keys) => {
      assertSettingsKeys(keys);

      return sendSync(channels.settingsGetItems, keys);
    },
    setAll: (settings) => {
      assertPlainObject(settings, 'Settings must be an object');

      return invoke(channels.settingsSetAll, settings);
    },
  },
  system: {
    isProcessRunning: (query) => {
      if (typeof query !== 'string') {
        throw new TypeError('Process query must be a string');
      }

      return invoke(channels.systemIsProcessRunning, query);
    },
  },
  log: {
    write: (args) => {
      assertPlainObject(args, 'Log arguments must be an object');

      return send(channels.rendererLog, args);
    },
  },
  platform: {
    getCapabilities: () => sendSync(channels.appGetCapabilities),
  },
  fileExplorer: {
    initialize: (args) => invoke(channels.fileExplorerInitialize, args),
    dispose: (args) => invoke(channels.fileExplorerDispose, args),
    listStorages: (args) => invoke(channels.fileExplorerListStorages, args),
    listFiles: (args) => invoke(channels.fileExplorerListFiles, args),
    renameFile: (args) => invoke(channels.fileExplorerRenameFile, args),
    deleteFiles: (args) => invoke(channels.fileExplorerDeleteFiles, args),
    makeDirectory: (args) => invoke(channels.fileExplorerMakeDirectory, args),
    filesExist: (args) => invoke(channels.fileExplorerFilesExist, args),
    transferFiles,
    fetchDebugReport: (args) =>
      invoke(channels.fileExplorerFetchDebugReport, args),
  },
  report: {
    getInfo: () => sendSync(channels.reportGetInfo),
    compressLog: () => invoke(channels.reportCompressLog),
  },
  menu: {
    popup: (items) => {
      assertChannel(channels.showContextMenu);

      return ipcRenderer.invoke(
        channels.showContextMenu,
        sanitizeMenuItems(items)
      );
    },
  },
});
