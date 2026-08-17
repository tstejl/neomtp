import { getOpenMtpApi } from './electronApi';

export const rendererSettings = {
  getAll: () => getOpenMtpApi().settings.getAll(),
  getItems: (keys) => getOpenMtpApi().settings.getItems(keys),
  setAll: (settings) => getOpenMtpApi().settings.setAll(settings),
};
