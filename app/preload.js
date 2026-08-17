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

  const wrapper = (_event, ...args) => listener(null, ...args);
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

  listenerWrappers.set(
    channel,
    channelListeners.filter((entry) => entry.listener !== listener)
  );
};

const send = (channel, ...args) => {
  assertChannel(channel);
  ipcRenderer.send(channel, ...args);
};

const sendSync = (channel, ...args) => {
  assertChannel(channel);

  return ipcRenderer.sendSync(channel, ...args);
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
