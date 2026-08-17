import { APP_THEME_MODE_TYPE } from '../enums';
import { undefinedOrNull } from '../utils/funcs';

// [appThemeModeSettings] is optional. When omitted, auto mode is used.
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
    _appThemeModeSettings = APP_THEME_MODE_TYPE.auto;
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
