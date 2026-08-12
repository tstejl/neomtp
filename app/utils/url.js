import { getOpenMtpApi } from '../helpers/electronApi';

export const openExternalUrl = (url, events = null, shellApi = null) => {
  if (events) {
    events.preventDefault();
  }

  (shellApi || getOpenMtpApi().shell).openExternal(url);
};
