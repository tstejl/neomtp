import { getNeoMtpApi } from './electronApi';

export const toggleWindowSizeOnDoubleClick = () => {
  const { window } = getNeoMtpApi();

  if (!window.isMaximized()) {
    window.maximize();

    return null;
  }

  window.unmaximize();
};
