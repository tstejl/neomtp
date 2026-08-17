import { getOpenMtpApi } from './electronApi';

export const rendererPaths = getOpenMtpApi().app.getPaths();

export const DEVICES_DEFAULT_PATH = {
  mtp: '/',
  local: rendererPaths.homeDir,
};
