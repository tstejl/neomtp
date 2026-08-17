import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import { join } from 'node:path';
import electronIs from 'electron-is';
import usbDetect from 'usb-detection';
import { IpcEvents } from './IpcEventType';
import {
  faqsWindow,
  helpPhoneNotConnectingWindow,
  privacyPolicyWindow,
  reportBugsWindow,
} from '../../helpers/createWindows';
import fileExplorerController from '../../data/file-explorer/controllers/FileExplorerController';
import { settingsStorage } from '../../helpers/storageHelper';
import { PATHS } from '../../constants/paths';
import { bootLoader } from '../../helpers/bootHelper';
import { isKalamModeSupported } from '../../helpers/binaries';
import { isProcessRunning } from '../../utils/process';
import { log } from '../../utils/log';
import { compressFile } from '../../utils/gzip';
import { fileExistsSync } from '../../helpers/fileOps';
import { baseName } from '../../utils/files';

const toIpcValue = (value) => {
  if (value instanceof Error) {
    return value.message;
  }

  if (value === null || typeof value === 'undefined') {
    return value ?? null;
  }

  return value;
};

const normalizeResult = (result) => {
  if (typeof result === 'boolean') {
    return result;
  }

  const value = result ?? {};

  return {
    ...value,
    error: toIpcValue(value.error),
    stderr: toIpcValue(value.stderr),
    data: typeof value.data === 'undefined' ? null : toIpcValue(value.data),
  };
};

const normalizeTransferPayload = (payload) => {
  if (payload === null || typeof payload === 'undefined') {
    return null;
  }

  if (typeof payload !== 'object') {
    return toIpcValue(payload);
  }

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, toIpcValue(value)])
  );
};

const reportInfo = () => {
  const zippedLogFileBaseName = `${baseName(PATHS.logFile)}.gz`;
  const logFileZippedPath = join(PATHS.desktopDir, zippedLogFileBaseName);

  return {
    logFile: PATHS.logFile,
    logFileZippedPath,
    zippedLogFileBaseName,
  };
};

const isMtpUnavailable = async () => {
  if (process.env.NEOMTP_NO_DEVICE_E2E === 'true') {
    return true;
  }

  try {
    const devices = await usbDetect.find();

    return !Array.isArray(devices) || devices.length === 0;
  } catch (error) {
    log.error(error, 'IpcEventService -> usbDetect.find', true, false, false);

    return false;
  }
};

export default class IpcEventService {
  static shared = new IpcEventService();

  #started = false;

  start() {
    if (this.#started) {
      return;
    }

    this.#started = true;
    this.#init();
  }

  #init = () => {
    ipcMain.on(IpcEvents.OPEN_FAQS_WINDOW, (_, __) => {
      faqsWindow();
    });
    ipcMain.on(IpcEvents.OPEN_HELP_PHONE_NOT_CONNECTING_WINDOW, (_, __) => {
      helpPhoneNotConnectingWindow();
    });
    ipcMain.on(IpcEvents.OPEN_HELP_PRIVACY_POLICY_WINDOW, (_, __) => {
      privacyPolicyWindow();
    });

    ipcMain.on(IpcEvents.REPORT_BUGS_DISPOSE_MTP, (event, args) => {
      BrowserWindow.getAllWindows().forEach((window) => {
        if (
          window.webContents.id !== event.sender.id &&
          !window.isDestroyed()
        ) {
          window.webContents.send(IpcEvents.REPORT_BUGS_DISPOSE_MTP, args);
        }
      });
    });

    ipcMain.on(IpcEvents.REPORT_BUGS_DISPOSE_MTP_REPLY, (_, args) => {
      reportBugsWindow(false)?.webContents.send(
        IpcEvents.REPORT_BUGS_DISPOSE_MTP_REPLY_FROM_MAIN,
        args
      );
    });

    ipcMain.on('fileExplorerToolbarActionCommunication', (event, args) => {
      event.sender.send('fileExplorerToolbarActionCommunication', args);
    });

    ipcMain.handle(IpcEvents.SHOW_CONTEXT_MENU, (event, items) => {
      const window = BrowserWindow.fromWebContents(event.sender);

      if (!window || window.isDestroyed() || !Array.isArray(items)) {
        return null;
      }

      return new Promise((resolve) => {
        let resolved = false;
        const resolveOnce = (value) => {
          if (resolved) {
            return;
          }

          resolved = true;
          resolve(value);
        };

        const menu = Menu.buildFromTemplate(
          items.map(({ id, label, enabled }) => ({
            label,
            enabled,
            click: () => resolveOnce(id),
          }))
        );

        menu.popup({
          window,
          callback: () => resolveOnce(null),
        });
      });
    });

    ipcMain.on(IpcEvents.GET_PATH, (event, name) => {
      if (typeof name !== 'string') {
        // eslint-disable-next-line no-param-reassign
        event.returnValue = null;

        return;
      }

      try {
        // eslint-disable-next-line no-param-reassign
        event.returnValue = app.getPath(name);
      } catch (e) {
        // eslint-disable-next-line no-param-reassign
        event.returnValue = null;
      }
    });

    ipcMain.on(IpcEvents.WINDOW_RELOAD, (event) => {
      event.sender.reload();
    });

    ipcMain.on(IpcEvents.WINDOW_MAXIMIZE, (event) => {
      BrowserWindow.fromWebContents(event.sender)?.maximize();
    });

    ipcMain.on(IpcEvents.WINDOW_UNMAXIMIZE, (event) => {
      BrowserWindow.fromWebContents(event.sender)?.unmaximize();
    });

    ipcMain.on(IpcEvents.WINDOW_IS_MAXIMIZED, (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue =
        BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
    });

    ipcMain.on(IpcEvents.WINDOW_SET_PROGRESS_BAR, (event, value) => {
      if (typeof value === 'number') {
        BrowserWindow.fromWebContents(event.sender)?.setProgressBar(value);
      }
    });

    ipcMain.on(IpcEvents.SETTINGS_GET_ALL, (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = settingsStorage.getAll() ?? {};
    });

    ipcMain.on(IpcEvents.SETTINGS_GET_ITEMS, (event, keys) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = Array.isArray(keys)
        ? settingsStorage.getItems(keys) ?? {}
        : {};
    });

    ipcMain.handle(IpcEvents.SETTINGS_SET_ALL, (_event, settings) => {
      if (
        settings === null ||
        typeof settings !== 'object' ||
        Array.isArray(settings)
      ) {
        return false;
      }

      settingsStorage.setAll(settings);

      return true;
    });

    ipcMain.on(IpcEvents.APP_GET_PATHS, (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = {
        homeDir: PATHS.homeDir,
        desktopDir: PATHS.desktopDir,
        downloadsDir: PATHS.downloadsDir,
        documentsDir: PATHS.documentsDir,
        picturesDir: PATHS.picturesDir,
        volumesDir: PATHS.volumesDir,
        systemRootDir: PATHS.systemRootDir,
        profileDir: PATHS.profileDir,
      };
    });

    ipcMain.on(IpcEvents.APP_GET_CAPABILITIES, (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = {
        isMas: electronIs.mas(),
        isKalamModeSupported: isKalamModeSupported(),
      };
    });

    ipcMain.handle(IpcEvents.APP_CLEAN_ROTATION_FILES, () => {
      bootLoader.cleanRotationFiles();

      return true;
    });

    ipcMain.handle(IpcEvents.SYSTEM_IS_PROCESS_RUNNING, (_event, query) => {
      if (typeof query !== 'string') {
        return false;
      }

      return isProcessRunning(query);
    });

    ipcMain.on(IpcEvents.RENDERER_LOG, (_event, args) => {
      if (
        args === null ||
        typeof args !== 'object' ||
        Array.isArray(args) ||
        typeof args.message === 'undefined'
      ) {
        return;
      }

      log.doLog(
        args.message,
        args.title ?? null,
        args.customError ?? null,
        args.logError !== false,
        args.report !== false,
        args.isError !== false
      );
    });

    const fileExplorerMethods = {
      [IpcEvents.FILE_EXPLORER_INITIALIZE]: 'initialize',
      [IpcEvents.FILE_EXPLORER_DISPOSE]: 'dispose',
      [IpcEvents.FILE_EXPLORER_LIST_STORAGES]: 'listStorages',
      [IpcEvents.FILE_EXPLORER_LIST_FILES]: 'listFiles',
      [IpcEvents.FILE_EXPLORER_RENAME_FILE]: 'renameFile',
      [IpcEvents.FILE_EXPLORER_DELETE_FILES]: 'deleteFiles',
      [IpcEvents.FILE_EXPLORER_MAKE_DIRECTORY]: 'makeDirectory',
      [IpcEvents.FILE_EXPLORER_FILES_EXIST]: 'filesExist',
      [IpcEvents.FILE_EXPLORER_FETCH_DEBUG_REPORT]: 'fetchDebugReport',
    };

    Object.entries(fileExplorerMethods).forEach(([channel, method]) => {
      ipcMain.handle(channel, async (_event, args) => {
        try {
          if (
            method === 'initialize' &&
            args?.deviceType === 'mtp' &&
            (await isMtpUnavailable())
          ) {
            return {
              error: null,
              stderr: 'ErrorMtpDetectFailed',
              data: null,
            };
          }

          return normalizeResult(await fileExplorerController[method](args));
        } catch (error) {
          return {
            error: toIpcValue(error),
            stderr: null,
            data: null,
          };
        }
      });
    });

    ipcMain.handle(
      IpcEvents.FILE_EXPLORER_TRANSFER_FILES,
      async (event, args = {}) => {
        const { requestId, ...transferArgs } = args;

        if (typeof requestId !== 'string') {
          return {
            error: 'Invalid file transfer request id',
            stderr: null,
            data: null,
          };
        }

        const sendTransferEvent = (type, payload) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IpcEvents.FILE_EXPLORER_TRANSFER_EVENT, {
              requestId,
              type,
              payload: normalizeTransferPayload(payload),
            });
          }
        };

        try {
          return normalizeResult(
            await fileExplorerController.transferFiles({
              ...transferArgs,
              onError: (payload) => sendTransferEvent('error', payload),
              onPreprocess: (payload) =>
                sendTransferEvent('preprocess', payload),
              onProgress: (payload) => sendTransferEvent('progress', payload),
              onCompleted: (payload) => sendTransferEvent('completed', payload),
            })
          );
        } catch (error) {
          sendTransferEvent('error', {
            error: toIpcValue(error),
            stderr: null,
            data: null,
          });

          return {
            error: toIpcValue(error),
            stderr: null,
            data: null,
          };
        }
      }
    );

    ipcMain.on(IpcEvents.REPORT_GET_INFO, (event) => {
      // eslint-disable-next-line no-param-reassign
      event.returnValue = reportInfo();
    });

    ipcMain.handle(IpcEvents.REPORT_COMPRESS_LOG, async () => {
      const { logFile, logFileZippedPath, zippedLogFileBaseName } =
        reportInfo();

      try {
        await compressFile(logFile, logFileZippedPath);

        return {
          error: null,
          data: {
            logFileZippedPath,
            zippedLogFileBaseName,
            exists: fileExistsSync(logFileZippedPath),
          },
          stderr: null,
        };
      } catch (error) {
        return {
          error: toIpcValue(error),
          data: null,
          stderr: null,
        };
      }
    });
  };
}
