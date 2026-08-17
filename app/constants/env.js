/**
 * Constants
 * Note: Don't import log helper file from utils here
 */

const isDev = process.env.NODE_ENV !== 'production';
const isProd = process.env.NODE_ENV === 'production';
const isDebug = process.env.DEBUG_PROD === 'true';

const config = {
  dev: {
    disableReactWarnings: true,
    allowDevelopmentEnvironment: true,
  },
  prod: {
    disableReactWarnings: false,
    allowDevelopmentEnvironment: false,
  },
  debug: {
    disableReactWarnings: false,
    allowDevelopmentEnvironment: true,
  },
};

let _env = 'dev';

if (isProd) {
  _env = 'prod';
} else if (isDebug) {
  _env = 'debug';
}

export const ENV_FLAVOR = config[_env];

export const IS_DEV = isDev;

export const IS_PROD = isProd;

export const DEBUG_PROD = isDebug;

export const IS_RENDERER =
  typeof process !== 'undefined' && process.type === 'renderer';
