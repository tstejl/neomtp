import { BrowserWindow, nativeTheme } from 'electron';
import { getAppThemeMode } from './theme';
import { getCurrentThemePalette } from '../containers/App/styles';

export const getMainWindowMainProcess = () => {
  const windows = BrowserWindow.getAllWindows();

  return windows.length ? windows[windows.length - 1] : null;
};

export const getWindowBackgroundColor = () => {
  const appThemeMode = getAppThemeMode(
    undefined,
    nativeTheme.shouldUseDarkColors
  );
  const { background } = getCurrentThemePalette(appThemeMode);

  return background.paper;
};
