const parsePath = (filePath) => {
  if (typeof filePath !== 'string') {
    return null;
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  const root = normalizedPath.startsWith('/') ? '/' : '';
  const dir =
    lastSlashIndex > -1 ? normalizedPath.slice(0, lastSlashIndex) || root : '';
  const base = normalizedPath.slice(lastSlashIndex + 1);
  const extensionIndex = base.lastIndexOf('.');
  const ext =
    extensionIndex > 0 && extensionIndex < base.length - 1
      ? base.slice(extensionIndex)
      : '';

  return {
    root,
    dir,
    base,
    ext,
    name: ext ? base.slice(0, -ext.length) : base,
  };
};

export const pathUp = (filePath) => {
  return filePath.replace(/\/$/, '').replace(/\/[^/]+$/, '') || '/';
};

export const sanitizePath = (filePath) => {
  return filePath.replace(/\/\/+/g, '/');
};

export const baseName = (filePath) => {
  if (typeof filePath === 'undefined' || filePath === null) {
    return null;
  }

  const parsedPath = pathInfo(filePath);

  return parsedPath !== null ? parsedPath.base : null;
};

export const getExtension = (fileName, isFolder) => {
  if (isFolder) {
    return null;
  }

  const parsedPath = pathInfo(fileName);

  return parsedPath !== null ? parsedPath.ext : null;
};

export const pathInfo = (filePath) => {
  return parsePath(filePath);
};
