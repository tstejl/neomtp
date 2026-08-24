import prefixer from '../../helpers/reducerPrefixer';
import { rendererSettings } from '../../helpers/rendererSettings';
import { initialState } from './reducers';

const prefix = '@@Settings';
const actionTypesList = [
  'TOGGLE_SETTINGS',
  'FRESH_INSTALL',
  'HIDE_HIDDEN_FILES',
  'FILE_EXPLORER_LISTING_TYPE',
  'SET_FILES_PREPROCESSING_BEFORE_TRANSFER',
  'COMMON_SETTINGS',
  'COPY_JSON_FILE_TO_SETTINGS',
];

const excludeItemsFromSettingsFile = ['toggleSettings'];

export const actionTypes = prefixer(prefix, actionTypesList);

export function toggleSettings(data) {
  return {
    type: actionTypes.TOGGLE_SETTINGS,
    payload: data,
  };
}

export function freshInstall({ ...data }, getState) {
  const { isFreshInstall } = data;

  return (dispatch) => {
    dispatch({
      type: actionTypes.FRESH_INSTALL,
      payload: isFreshInstall,
    });

    dispatch(copySettingsToJsonFile(getState));
  };
}

export function hideHiddenFiles({ ...data }, deviceType, getState) {
  const { value } = data;

  return (dispatch) => {
    dispatch({
      type: actionTypes.HIDE_HIDDEN_FILES,
      deviceType,
      payload: value,
    });

    dispatch(copySettingsToJsonFile(getState));
  };
}

export function setFilesPreprocessingBeforeTransfer({ ...data }, getState) {
  const { value, direction } = data;

  return (dispatch) => {
    dispatch({
      type: actionTypes.SET_FILES_PREPROCESSING_BEFORE_TRANSFER,
      deviceType: null,
      payload: { value, direction },
    });

    dispatch(copySettingsToJsonFile(getState));
  };
}

export function fileExplorerListingType({ ...data }, deviceType, getState) {
  const { value } = data;

  return (dispatch) => {
    dispatch({
      type: actionTypes.FILE_EXPLORER_LISTING_TYPE,
      deviceType,
      payload: value,
    });

    dispatch(copySettingsToJsonFile(getState));
  };
}

// @param [key]: settings key name
// @param [value]: settings value
export function setCommonSettings(
  { key, value, onSuccess },
  deviceType,
  getState
) {
  if (typeof initialState[key] === 'undefined') {
    // eslint-disable-next-line no-throw-literal
    throw `invalid settings key: ${key}`;
  }

  return async (dispatch) => {
    dispatch({
      type: actionTypes.COMMON_SETTINGS,
      deviceType,
      payload: {
        key,
        value,
      },
    });

    dispatch(
      copySettingsToJsonFile(getState, () => {
        if (onSuccess) {
          onSuccess();
        }
      })
    );
  };
}

export function copySettingsToJsonFile(getState, onSuccess) {
  return async (_) => {
    const settingsState = getState().Settings ? getState().Settings : {};
    const filteredSettings = Object.fromEntries(
      Object.entries(settingsState).filter(
        ([key]) => !excludeItemsFromSettingsFile.includes(key)
      )
    );

    await rendererSettings.setAll({ ...filteredSettings });

    if (onSuccess) {
      onSuccess();
    }
  };
}

export function copyJsonFileToSettings({ ...data }) {
  return {
    type: actionTypes.COPY_JSON_FILE_TO_SETTINGS,
    payload: {
      ...data,
    },
  };
}
