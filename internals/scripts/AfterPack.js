const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');
const glob = require('glob');
const fs = require('fs-extra');
const { Arch } = require('electron-builder');

const execFileAsync = promisify(execFile);

const macNativeTargets = {
  [Arch.arm64]: {
    directory: 'arm64',
    machoArchitecture: 'arm64',
  },
  [Arch.x64]: {
    directory: 'amd64',
    machoArchitecture: 'x86_64',
  },
};

const prepareMacNativeBinaries = async ({ arch, resourcesDirectory }) => {
  const target = macNativeTargets[arch];

  if (!target) {
    throw new Error(`Unsupported macOS package architecture: ${Arch[arch]}`);
  }

  const binaryDirectory = path.join(resourcesDirectory, 'bin');
  const targetDirectory = path.join(binaryDirectory, target.directory);
  const unusedDirectories = ['arm64', 'amd64', 'medieval'].filter(
    (directory) => directory !== target.directory
  );

  await Promise.all(
    unusedDirectories.map((directory) =>
      fs.remove(path.join(binaryDirectory, directory))
    )
  );

  const requiredMachOBinaries = [
    'kalam.dylib',
    'libusb.dylib',
    'kalam_debug_report',
  ];

  await Promise.all(
    requiredMachOBinaries.map(async (fileName) => {
      const filePath = path.join(targetDirectory, fileName);

      if (!(await fs.pathExists(filePath))) {
        throw new Error(`Missing packaged native binary: ${filePath}`);
      }

      await execFileAsync('lipo', [
        filePath,
        '-verify_arch',
        target.machoArchitecture,
      ]);
    })
  );
};

exports.default = async (context) => {
  // clean the unnecessary locales from packed app
  const lprojRegEx = /^en\.lproj$/;
  const APP_NAME = context.packager.appInfo.productFilename;
  const APP_OUT_DIR = context.appOutDir;
  const PLATFORM = context.packager.platform.name;

  const cwd = path.join(`${APP_OUT_DIR}`, `${APP_NAME}.app/Contents/Resources`);
  const lproj = glob.sync('*.lproj', { cwd });

  switch (PLATFORM) {
    case 'mac':
      await Promise.all(
        lproj
          .filter((dir) => !lprojRegEx.test(dir))
          .map((dir) => fs.remove(path.join(cwd, dir)))
      );
      await prepareMacNativeBinaries({
        arch: context.arch,
        resourcesDirectory: cwd,
      });

      break;
    default:
      break;
  }

  return undefined;
};
