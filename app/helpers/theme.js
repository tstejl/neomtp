import { APP_THEME_MODE_TYPE } from '../enums';
import { undefinedOrNull } from '../utils/funcs';
import { getAppThemeModeSetting } from './settings';

// [appThemeModeSettings] is optional
// if [appThemeModeSettings] is not provided then fetch the theme value from the settings
export const getAppThemeMode = (
  appThemeModeSettings,
  systemShouldUseDarkColors
) => {
  const shouldUseDarkColors =
    systemShouldUseDarkColors ??
    (typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  let _appThemeModeSettings = appThemeModeSettings;

  if (undefinedOrNull(_appThemeModeSettings)) {
    _appThemeModeSettings = getAppThemeModeSetting();
  }

  switch (_appThemeModeSettings) {
    case APP_THEME_MODE_TYPE.dark:
      return _appThemeModeSettings;

    case APP_THEME_MODE_TYPE.light:
      return _appThemeModeSettings;

    default:
      if (shouldUseDarkColors) {
        return APP_THEME_MODE_TYPE.dark;
      }

      return APP_THEME_MODE_TYPE.light;
  }
};

export const getContrastingTheme = (appThemeMode) => {
  if (appThemeMode === APP_THEME_MODE_TYPE.dark) {
    return APP_THEME_MODE_TYPE.light;
  }

  return APP_THEME_MODE_TYPE.dark;
};
