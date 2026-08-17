export const openExternalUrl = (url, events = null, shellApi = null) => {
  if (events) {
    events.preventDefault();
  }

  const rendererShell =
    typeof window !== 'undefined' ? window.openmtp?.shell : null;

  (shellApi || rendererShell)?.openExternal(url);
};
