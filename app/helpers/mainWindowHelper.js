import { BrowserWindow, nativeTheme } from 'electron';
import { getAppThemeMode } from './theme';
import { getAppThemeModeSetting } from './settings';
import { getCurrentThemePalette } from '../containers/App/styles';

export const getMainWindowMainProcess = () => {
  const windows = BrowserWindow.getAllWindows();

  return windows.length ? windows[windows.length - 1] : null;
};

export const getWindowBackgroundColor = () => {
  const appThemeMode = getAppThemeMode(
    getAppThemeModeSetting(),
    nativeTheme.shouldUseDarkColors
  );
  const { background } = getCurrentThemePalette(appThemeMode);

  return background.paper;
};
