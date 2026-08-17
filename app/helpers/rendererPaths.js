import { getNeoMtpApi } from './electronApi';

export const rendererPaths = getNeoMtpApi().app.getPaths();

export const DEVICES_DEFAULT_PATH = {
  mtp: '/',
  local: rendererPaths.homeDir,
};
