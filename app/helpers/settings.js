import { settingsStorage } from './storageHelper';
import { getAppThemeMode } from './theme';
import { isPrereleaseVersion, undefinedOrNull } from '../utils/funcs';
import { checkIf } from '../utils/checkIf';
import { APP_THEME_MODE_TYPE, FILE_TRANSFER_DIRECTION } from '../enums';

const defaultSettings = {
  appThemeMode: APP_THEME_MODE_TYPE.auto,
  enablePrereleaseUpdates: isPrereleaseVersion() || false,
  filesPreprocessingBeforeTransfer: {
    [FILE_TRANSFER_DIRECTION.upload]: true,
    [FILE_TRANSFER_DIRECTION.download]: true,
  },
};

export const getAppThemeModeSetting = () => {
  const setting = settingsStorage.getItems(['appThemeMode']);

  let value = setting.appThemeMode;

  if (undefinedOrNull(value)) {
    value = defaultSettings.appThemeMode;
  }

  return getAppThemeMode(value);
};

export const getFilesPreprocessingBeforeTransferSetting = ({ direction }) => {
  checkIf(direction, 'string');
  checkIf(direction, 'inObjectValues', FILE_TRANSFER_DIRECTION);

  const setting = settingsStorage.getItems([
    'filesPreprocessingBeforeTransfer',
  ]);

  let value = setting.filesPreprocessingBeforeTransfer
    ? setting.filesPreprocessingBeforeTransfer[direction]
    : null;

  if (undefinedOrNull(value)) {
    value = defaultSettings.filesPreprocessingBeforeTransfer[direction];
  }

  checkIf(value, 'boolean');

  return value;
};

export const getEnablePrereleaseUpdatesSetting = () => {
  const setting = settingsStorage.getItems(['enablePrereleaseUpdates']);

  let value = setting.enablePrereleaseUpdates;

  const isPrerelease = isPrereleaseVersion();

  if (isPrerelease) {
    return true;
  }

  if (undefinedOrNull(value)) {
    value = defaultSettings.enablePrereleaseUpdates;
  }

  return value;
};
