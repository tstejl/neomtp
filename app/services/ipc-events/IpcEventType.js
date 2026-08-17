export class IpcEvents {
  static OPEN_FAQS_WINDOW = 'ipc.window.faqs';

  static OPEN_HELP_PHONE_NOT_CONNECTING_WINDOW =
    'ipc.window.helpPhoneNotConnecting';

  static OPEN_HELP_PRIVACY_POLICY_WINDOW = 'ipc.window.privacyPolicy';

  static OPEN_KEYBOARD_SHORTCUTS_WINDOW = 'ipc.window.keyboardShortcuts';

  static REPORT_BUGS_DISPOSE_MTP = 'ipc.reportBugsDisposeMtp';

  static REPORT_BUGS_DISPOSE_MTP_REPLY = 'ipc.reportBugsDisposeMtpReply';

  static REPORT_BUGS_DISPOSE_MTP_REPLY_FROM_MAIN =
    'ipc.reportBugsDisposeMtpReply.fromMain';

  static USB_HOTPLUG = 'ipc.usbHotplug';

  static SHOW_CONTEXT_MENU = 'ipc.contextMenu.show';

  static GET_PATH = 'ipc.app.getPath';

  static WINDOW_RELOAD = 'ipc.window.reload';

  static WINDOW_MAXIMIZE = 'ipc.window.maximize';

  static WINDOW_UNMAXIMIZE = 'ipc.window.unmaximize';

  static WINDOW_IS_MAXIMIZED = 'ipc.window.isMaximized';

  static WINDOW_SET_PROGRESS_BAR = 'ipc.window.setProgressBar';

  static SETTINGS_GET_ALL = 'ipc.settings.getAll';

  static SETTINGS_GET_ITEMS = 'ipc.settings.getItems';

  static SETTINGS_SET_ALL = 'ipc.settings.setAll';

  static APP_GET_PATHS = 'ipc.app.getPaths';

  static APP_GET_CAPABILITIES = 'ipc.app.getCapabilities';

  static APP_CLEAN_ROTATION_FILES = 'ipc.app.cleanRotationFiles';

  static SYSTEM_IS_PROCESS_RUNNING = 'ipc.system.isProcessRunning';

  static RENDERER_LOG = 'ipc.renderer.log';

  static FILE_EXPLORER_INITIALIZE = 'ipc.fileExplorer.initialize';

  static FILE_EXPLORER_DISPOSE = 'ipc.fileExplorer.dispose';

  static FILE_EXPLORER_LIST_STORAGES = 'ipc.fileExplorer.listStorages';

  static FILE_EXPLORER_LIST_FILES = 'ipc.fileExplorer.listFiles';

  static FILE_EXPLORER_RENAME_FILE = 'ipc.fileExplorer.renameFile';

  static FILE_EXPLORER_DELETE_FILES = 'ipc.fileExplorer.deleteFiles';

  static FILE_EXPLORER_MAKE_DIRECTORY = 'ipc.fileExplorer.makeDirectory';

  static FILE_EXPLORER_FILES_EXIST = 'ipc.fileExplorer.filesExist';

  static FILE_EXPLORER_TRANSFER_FILES = 'ipc.fileExplorer.transferFiles';

  static FILE_EXPLORER_TRANSFER_EVENT = 'ipc.fileExplorer.transferEvent';

  static FILE_EXPLORER_FETCH_DEBUG_REPORT = 'ipc.fileExplorer.fetchDebugReport';

  static REPORT_GET_INFO = 'ipc.report.getInfo';

  static REPORT_COMPRESS_LOG = 'ipc.report.compressLog';
}
