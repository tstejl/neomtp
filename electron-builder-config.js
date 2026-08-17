const isCodeSigningDisabled =
  process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false';
const isLocalMacBuild = process.env.ELECTRON_NOTARIZE === 'NO';

module.exports = () => {
  const getMacExtraFiles = () => {
    return [
      {
        from: 'build/mac/bin',
        to: 'Resources/bin',
        filter: ['arm64/**/*', 'amd64/**/*', 'mtp-cli'],
      },
    ];
  };

  return {
    productName: 'OpenMTP',
    appId: 'io.ganeshrvel.openmtp',
    forceCodeSigning: !isCodeSigningDisabled,
    // eslint-disable-next-line no-template-curly-in-string
    artifactName: '${name}-${version}-${os}-${arch}.${ext}',
    copyright: '© Ganesh Rathinavel',
    afterPack: './internals/scripts/AfterPack.js',
    afterSign: './internals/scripts/Notarize.js',
    npmRebuild: false,
    publish: [
      {
        provider: 'github',
        owner: 'tstejl',
        repo: 'openmtp',
        private: false,
      },
    ],
    files: [
      'app/dist/',
      'app/preload.js',
      'app/main-*.js',
      'app/main-*.js.map',
      'app/main.prod.js',
      'app/main.prod.js.map',
      'package.json',
    ],
    mac: {
      ...(isCodeSigningDisabled ? { identity: null } : {}),
      extraFiles: getMacExtraFiles(),
      type: isLocalMacBuild ? 'development' : 'distribution',
      icon: 'build/icon.icns',
      category: 'public.app-category.productivity',
      hardenedRuntime: true,
      gatekeeperAssess: false,
      entitlements: './build/entitlements.mac.plist',
      entitlementsInherit: './build/entitlements.mac.plist',
      extendInfo: {
        LSMinimumSystemVersion: '11.0.0',
        NSDesktopFolderUsageDescription: 'Desktop folder access',
        NSDocumentsFolderUsageDescription: 'Documents folder access',
        NSDownloadsFolderUsageDescription: 'Downloads folder access',
        NSRemovableVolumesUsageDescription: 'Removable Disk access',
        NSPhotoLibraryUsageDescription: 'Photo library access',
      },
      target: {
        target: 'default',
      },
    },
    mas: {
      type: 'distribution',
      category: 'public.app-category.productivity',
      entitlements: 'build/entitlements.mas.plist',
      icon: 'build/icon.icns',
      binaries: ['dist/mas/OpenMTP.app/Contents/Resources/bin/mtp-cli'],
    },
    dmg: {
      contents: [
        {
          x: 130,
          y: 220,
        },
        {
          x: 410,
          y: 220,
          type: 'link',
          path: '/Applications',
        },
      ],
    },
    win: {
      target: ['nsis'],
    },
    linux: {
      target: ['deb', 'AppImage'],
      category: 'public.app-category.productivity',
    },
  };
};
