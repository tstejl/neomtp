import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import { IpcEvents } from './IpcEventType';
import {
  faqsWindow,
  helpPhoneNotConnectingWindow,
  privacyPolicyWindow,
  reportBugsWindow,
} from '../../helpers/createWindows';

export default class IpcEventService {
  static shared = new IpcEventService();

  start() {
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
  };
}
