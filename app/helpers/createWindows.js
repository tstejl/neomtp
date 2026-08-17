import { BrowserWindow } from 'electron';
import { getRendererUrl, PATHS } from '../constants/paths';
import { log } from '../utils/log';
import { loadProfileErrorHtml } from '../templates/loadProfileError';
import { APP_TITLE } from '../constants/meta';
import { undefinedOrNull } from '../utils/funcs';
import { PRIVACY_POLICY_PAGE_TITLE } from '../templates/privacyPolicyPage';
import {
  FAQS_PAGE_TITLE,
  HELP_PHONE_IS_NOT_CONNECTING,
} from '../templates/helpFaqsPage';
import { KEYBOARD_SHORTCUTS_PAGE_TITLE } from '../templates/keyboardShortcutsPage';
import { getWindowBackgroundColor } from './mainWindowHelper';
import { REPORT_BUGS_PAGE_TITLE } from '../templates/generateErrorReport';

let _nonBootableDeviceWindow = null;
let _reportBugsWindow = null;
let _privacyPolicyWindow = null;
let _faqsWindow = null;
let _helpPhoneIsNotConnectingWindow = null;
let _appUpdateAvailableWindow = null;
let _keyboardShortcutsWindow = null;

const createBrowserWindow = (config) =>
  new BrowserWindow({
    ...config,
    webPreferences: {
      ...config.webPreferences,
      preload: PATHS.preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

const showWindowAfterLoad = (windowObj, focus) => {
  windowObj.webContents.on('did-finish-load', () => {
    if (focus) {
      windowObj.show();
      windowObj.focus();
    }
  });
};

/**
 * Non Bootable Device Window
 */

const nonBootableDeviceCreateWindow = () =>
  createBrowserWindow({
    title: `${APP_TITLE}`,
    center: true,
    show: false,
    maximizable: false,
    minimizable: false,
    width: 480,
    height: 320,
    resizable: false,
    backgroundColor: getWindowBackgroundColor(),
  });

export const nonBootableDeviceWindow = () => {
  _nonBootableDeviceWindow = nonBootableDeviceCreateWindow();

  _nonBootableDeviceWindow.loadURL(
    `data:text/html;charset=utf-8, ${encodeURI(loadProfileErrorHtml)}`
  );

  _nonBootableDeviceWindow.webContents.on('did-finish-load', () => {
    if (!_nonBootableDeviceWindow) {
      throw new Error(`"nonBootableDeviceWindow" is not defined`);
    }

    if (process.env.START_MINIMIZED) {
      _nonBootableDeviceWindow.minimize();
    } else {
      _nonBootableDeviceWindow.show();
      _nonBootableDeviceWindow.focus();
    }
  });

  _nonBootableDeviceWindow.on('closed', () => {
    _nonBootableDeviceWindow = null;
  });

  return _nonBootableDeviceWindow;
};

/**
 * Report Bugs Window
 */

const reportBugsCreateWindow = () => {
  const config = {
    height: 480,
    width: 600,
    show: false,
    resizable: false,
    title: `${APP_TITLE}`,
    minimizable: false,
    fullscreenable: false,
    backgroundColor: getWindowBackgroundColor(),
  };

  const existingWindow = loadExistingWindow(
    BrowserWindow.getAllWindows(),
    REPORT_BUGS_PAGE_TITLE
  );

  return {
    windowObj: existingWindow ?? createBrowserWindow(config),
    isExisting: !!existingWindow,
  };
};

export const reportBugsWindow = (focus = true) => {
  try {
    if (_reportBugsWindow) {
      if (focus) {
        _reportBugsWindow.focus();
        _reportBugsWindow.show();
      }

      return _reportBugsWindow;
    }

    const { windowObj, isExisting } = reportBugsCreateWindow();

    if (isExisting) {
      return windowObj;
    }

    _reportBugsWindow = windowObj;
    _reportBugsWindow.loadURL(`${getRendererUrl()}#reportBugsPage`);
    showWindowAfterLoad(_reportBugsWindow, focus);

    _reportBugsWindow.onerror = (error) => {
      log.error(error, `createWindows -> reportBugsWindow -> onerror`);
    };

    _reportBugsWindow.on('closed', () => {
      _reportBugsWindow = null;
    });

    return _reportBugsWindow;
  } catch (e) {
    log.error(e, `createWindows -> reportBugsWindow`);
  }
};

/**
 * Privacy Policy Window
 */

const privacyPolicyCreateWindow = () => {
  const config = {
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    show: false,
    resizable: true,
    title: `${APP_TITLE}`,
    minimizable: true,
    fullscreenable: true,
    backgroundColor: getWindowBackgroundColor(),
  };

  const existingWindow = loadExistingWindow(
    BrowserWindow.getAllWindows(),
    PRIVACY_POLICY_PAGE_TITLE
  );

  return {
    windowObj: existingWindow ?? createBrowserWindow(config),
    isExisting: !!existingWindow,
  };
};

export const privacyPolicyWindow = (focus = true) => {
  try {
    if (_privacyPolicyWindow) {
      if (focus) {
        _privacyPolicyWindow.focus();
        _privacyPolicyWindow.show();
      }

      return _privacyPolicyWindow;
    }

    const { windowObj, isExisting } = privacyPolicyCreateWindow();

    if (isExisting) {
      return windowObj;
    }

    _privacyPolicyWindow = windowObj;
    _privacyPolicyWindow.loadURL(`${getRendererUrl()}#privacyPolicyPage`);
    showWindowAfterLoad(_privacyPolicyWindow, focus);

    _privacyPolicyWindow.onerror = (error) => {
      log.error(error, `createWindows -> privacyPolicyWindow -> onerror`);
    };

    _privacyPolicyWindow.on('closed', () => {
      _privacyPolicyWindow = null;
    });

    return _privacyPolicyWindow;
  } catch (e) {
    log.error(e, `createWindows -> privacyPolicyWindow`);
  }
};

/**
 * App Update Available Window
 */
const appUpdateAvailableCreateWindow = () =>
  createBrowserWindow({
    width: 650,
    height: 552,
    show: false,
    resizable: false,
    title: `${APP_TITLE}`,
    minimizable: true,
    fullscreenable: false,
    backgroundColor: getWindowBackgroundColor(),
  });

export const appUpdateAvailableWindow = () => {
  try {
    if (_appUpdateAvailableWindow) {
      _appUpdateAvailableWindow.focus();
      _appUpdateAvailableWindow.show();

      return _appUpdateAvailableWindow;
    }

    _appUpdateAvailableWindow = appUpdateAvailableCreateWindow();

    if (!_appUpdateAvailableWindow) {
      return null;
    }

    _appUpdateAvailableWindow.loadURL(
      `${getRendererUrl()}#appUpdatePage/updateAvailable`
    );
    showWindowAfterLoad(_appUpdateAvailableWindow, true);

    _appUpdateAvailableWindow.onerror = (error) => {
      log.error(error, `createWindows -> appUpdateAvailableWindow -> onerror`);
    };

    _appUpdateAvailableWindow.on('closed', () => {
      _appUpdateAvailableWindow = null;
    });

    return _appUpdateAvailableWindow;
  } catch (e) {
    log.error(e, `createWindows -> appUpdateAvailableWindow`);
  }
};

/**
 * Keyboard Shortcuts Window
 */

const keyboardShortcutsCreateWindow = () => {
  const config = {
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    show: false,
    resizable: true,
    title: `${APP_TITLE}`,
    minimizable: true,
    fullscreenable: true,
    backgroundColor: getWindowBackgroundColor(),
  };

  const existingWindow = loadExistingWindow(
    BrowserWindow.getAllWindows(),
    KEYBOARD_SHORTCUTS_PAGE_TITLE
  );

  return {
    windowObj: existingWindow ?? createBrowserWindow(config),
    isExisting: !!existingWindow,
  };
};

export const keyboardShortcutsWindow = (focus = true) => {
  try {
    if (_keyboardShortcutsWindow) {
      if (focus) {
        _keyboardShortcutsWindow.focus();
        _keyboardShortcutsWindow.show();
      }

      return _keyboardShortcutsWindow;
    }

    const { windowObj, isExisting } = keyboardShortcutsCreateWindow();

    if (isExisting) {
      return windowObj;
    }

    _keyboardShortcutsWindow = windowObj;
    _keyboardShortcutsWindow.loadURL(
      `${getRendererUrl()}#keyboardShortcutsPage`
    );
    showWindowAfterLoad(_keyboardShortcutsWindow, focus);

    _keyboardShortcutsWindow.onerror = (error) => {
      log.error(error, `createWindows -> keyboardShortcutsWindow -> onerror`);
    };

    _keyboardShortcutsWindow.on('closed', () => {
      _keyboardShortcutsWindow = null;
    });

    return _keyboardShortcutsWindow;
  } catch (e) {
    log.error(e, `createWindows -> keyboardShortcutsWindow`);
  }
};

/**
 * FAQs Window
 */

const helpFaqsCreateWindow = () => {
  const config = {
    width: 920,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    show: false,
    resizable: true,
    title: `${APP_TITLE}`,
    minimizable: true,
    fullscreenable: true,
    backgroundColor: getWindowBackgroundColor(),
  };

  const existingWindow = loadExistingWindow(
    BrowserWindow.getAllWindows(),
    FAQS_PAGE_TITLE
  );

  return {
    windowObj: existingWindow ?? createBrowserWindow(config),
    isExisting: !!existingWindow,
  };
};

export const faqsWindow = (focus = true) => {
  try {
    if (_faqsWindow) {
      if (focus) {
        _faqsWindow.focus();
        _faqsWindow.show();
      }

      return _faqsWindow;
    }

    const { windowObj, isExisting } = helpFaqsCreateWindow();

    if (isExisting) {
      return windowObj;
    }

    _faqsWindow = windowObj;
    _faqsWindow.loadURL(`${getRendererUrl()}#faqsPage`);
    showWindowAfterLoad(_faqsWindow, focus);

    _faqsWindow.onerror = (error) => {
      log.error(error, `createWindows -> faqsWindow -> onerror`);
    };

    _faqsWindow.on('closed', () => {
      _faqsWindow = null;
    });

    return _faqsWindow;
  } catch (e) {
    log.error(e, `createWindows -> faqsWindow`);
  }
};

/**
 * Help - my Phone is not connecting window
 */

const helpPhoneNotConnectingCreateWindow = () => {
  const config = {
    width: 920,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    show: false,
    resizable: true,
    title: `${APP_TITLE}`,
    minimizable: true,
    fullscreenable: true,
    backgroundColor: getWindowBackgroundColor(),
  };

  const existingWindow = loadExistingWindow(
    BrowserWindow.getAllWindows(),
    HELP_PHONE_IS_NOT_CONNECTING
  );

  return {
    windowObj: existingWindow ?? createBrowserWindow(config),
    isExisting: !!existingWindow,
  };
};

export const helpPhoneNotConnectingWindow = (focus = true) => {
  try {
    if (_helpPhoneIsNotConnectingWindow) {
      if (focus) {
        _helpPhoneIsNotConnectingWindow.focus();
        _helpPhoneIsNotConnectingWindow.show();
      }

      return _helpPhoneIsNotConnectingWindow;
    }

    const { windowObj, isExisting } = helpPhoneNotConnectingCreateWindow();

    if (isExisting) {
      return windowObj;
    }

    _helpPhoneIsNotConnectingWindow = windowObj;
    _helpPhoneIsNotConnectingWindow.loadURL(
      `${getRendererUrl()}#helpPhoneNotConnectingPage`
    );
    showWindowAfterLoad(_helpPhoneIsNotConnectingWindow, focus);

    _helpPhoneIsNotConnectingWindow.onerror = (error) => {
      log.error(
        error,
        `createWindows -> helpPhoneNotConnectingWindow -> onerror`
      );
    };

    _helpPhoneIsNotConnectingWindow.on('closed', () => {
      _helpPhoneIsNotConnectingWindow = null;
    });

    return _helpPhoneIsNotConnectingWindow;
  } catch (e) {
    log.error(e, `createWindows -> helpPhoneNotConnectingWindow`);
  }
};

// Load an Existing Window
export const loadExistingWindow = (allWindows, title) => {
  if (!undefinedOrNull(allWindows)) {
    for (let i = 0; i < allWindows.length; i += 1) {
      const item = allWindows[i];

      if (item.getTitle().indexOf(title) !== -1) {
        item.focus();
        item.show();

        return item;
      }
    }
  }

  return null;
};
