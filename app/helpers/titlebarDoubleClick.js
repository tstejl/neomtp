import { getOpenMtpApi } from './electronApi';

export const toggleWindowSizeOnDoubleClick = () => {
  const { window } = getOpenMtpApi();

  if (!window.isMaximized()) {
    window.maximize();

    return null;
  }

  window.unmaximize();
};
