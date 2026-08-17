let _pkginfo = {};

// eslint-disable-next-line no-undef
if (typeof PKG_INFO !== 'undefined' && PKG_INFO !== null) {
  // eslint-disable-next-line no-undef
  _pkginfo = PKG_INFO;
} else {
  // electron-vite injects PKG_INFO for both development and production builds.
  // Keep an empty fallback for tools that import this module outside Electron.
  _pkginfo = {};
}

export const pkginfo = _pkginfo;
