/* eslint-disable no-console */

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const transferEventChannel = 'ipc.fileExplorer.transferEvent';
const preloadSource = fs.readFileSync(
  path.resolve(__dirname, '../app/preload-src.js'),
  'utf8'
);

class FakeIpcRenderer extends EventEmitter {
  constructor(invokeHandler) {
    super();
    this.invokeHandler = invokeHandler;
  }

  invoke(channel, args) {
    return this.invokeHandler({ channel, args, ipcRenderer: this });
  }

  send() {}

  sendSync() {
    return null;
  }
}

const loadPreload = (invokeHandler) => {
  const ipcRenderer = new FakeIpcRenderer(invokeHandler);
  let api = null;
  const electron = {
    contextBridge: {
      exposeInMainWorld(name, value) {
        assert.equal(name, 'neomtp');
        api = value;
      },
    },
    ipcRenderer,
    shell: {
      openExternal: async () => {},
      openPath: async () => {},
      showItemInFolder: () => {},
    },
  };

  vm.runInNewContext(preloadSource, {
    console,
    require(moduleName) {
      if (moduleName === 'electron') {
        return electron;
      }

      throw new Error(`Unexpected preload module: ${moduleName}`);
    },
  });

  assert.ok(api);

  return { api, ipcRenderer };
};

const settleWithin = async (promise, milliseconds = 2000) => {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('Timed out waiting for transfer result')),
          milliseconds
        );
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const callbacks = () => {
  const events = {
    errors: [],
    preprocess: [],
    progress: [],
    completed: [],
  };

  return {
    events,
    handlers: {
      onError: (payload) => events.errors.push(payload),
      onPreprocess: (payload) => events.preprocess.push(payload),
      onProgress: (payload) => events.progress.push(payload),
      onCompleted: (payload) => events.completed.push(payload),
    },
  };
};

const testCompletionAfterInvokeResponse = async () => {
  const expectedResponse = { error: null, stderr: null, data: true };
  const { api, ipcRenderer } = loadPreload(
    async ({ args, ipcRenderer: renderer }) => {
      renderer.emit(transferEventChannel, null, {
        requestId: args.requestId,
        type: 'preprocess',
        payload: { name: 'fixture.bin' },
      });
      renderer.emit(transferEventChannel, null, {
        requestId: args.requestId,
        type: 'progress',
        payload: { totalFileProgress: 100 },
      });
      setImmediate(() => {
        renderer.emit(transferEventChannel, null, {
          requestId: args.requestId,
          type: 'completed',
          payload: null,
        });
        renderer.emit(transferEventChannel, null, {
          requestId: args.requestId,
          type: 'completed',
          payload: null,
        });
      });

      return expectedResponse;
    }
  );
  const { events, handlers } = callbacks();
  const response = await settleWithin(
    api.fileExplorer.transferFiles({
      deviceType: 'mtp',
      direction: 'upload',
      fileList: ['/fixture.bin'],
      destination: '/',
      storageId: 1,
      ...handlers,
    })
  );

  assert.equal(response, expectedResponse);
  assert.equal(events.errors.length, 0);
  assert.equal(events.preprocess.length, 1);
  assert.equal(events.progress.length, 1);
  assert.equal(events.completed.length, 1);
  assert.equal(ipcRenderer.listenerCount(transferEventChannel), 0);
};

const testErrorResponseWithoutEvent = async () => {
  const expectedResponse = {
    error: 'transfer failed',
    stderr: null,
    data: null,
  };
  const { api, ipcRenderer } = loadPreload(async () => expectedResponse);
  const { events, handlers } = callbacks();
  const response = await settleWithin(
    api.fileExplorer.transferFiles({
      deviceType: 'mtp',
      direction: 'download',
      fileList: ['/fixture.bin'],
      destination: '/tmp',
      storageId: 1,
      ...handlers,
    })
  );

  assert.equal(response, expectedResponse);
  assert.deepEqual(events.errors, [expectedResponse]);
  assert.equal(events.completed.length, 0);
  assert.equal(ipcRenderer.listenerCount(transferEventChannel), 0);
};

const testInvokeRejection = async () => {
  const { api, ipcRenderer } = loadPreload(async () => {
    throw new Error('IPC unavailable');
  });
  const { events, handlers } = callbacks();

  await assert.rejects(
    settleWithin(
      api.fileExplorer.transferFiles({
        deviceType: 'mtp',
        direction: 'upload',
        fileList: ['/fixture.bin'],
        destination: '/',
        storageId: 1,
        ...handlers,
      })
    ),
    /IPC unavailable/
  );
  assert.equal(events.errors.length, 1);
  assert.equal(events.errors[0].error, 'IPC unavailable');
  assert.equal(events.completed.length, 0);
  assert.equal(ipcRenderer.listenerCount(transferEventChannel), 0);
};

Promise.resolve()
  .then(testCompletionAfterInvokeResponse)
  .then(testErrorResponseWithoutEvent)
  .then(testInvokeRejection)
  .then(() => console.log('Preload transfer lifecycle tests passed'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
