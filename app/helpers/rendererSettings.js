import { getNeoMtpApi } from './electronApi';

export const rendererSettings = {
  getAll: () => getNeoMtpApi().settings.getAll(),
  getItems: (keys) => getNeoMtpApi().settings.getItems(keys),
  setAll: (settings) => getNeoMtpApi().settings.setAll(settings),
};
