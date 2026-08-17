import { getOpenMtpApi } from '../helpers/electronApi';

const toLogValue = (value) => {
  if (value instanceof Error) {
    return `${value.message}\n${value.stack ?? ''}`.trim();
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
};

const writeLog = ({
  message,
  title,
  customError,
  logError,
  report,
  isError,
}) => {
  try {
    getOpenMtpApi().log.write({
      message: toLogValue(message),
      title,
      customError: toLogValue(customError),
      logError,
      report,
      isError,
    });
  } catch (error) {
    // Logging must not interrupt the renderer when the window is closing.
    console.error(error);
  }
};

export const log = {
  printBoundary(char = '═', length = 70) {
    let output = char;

    for (let i = 0; i < length; i += 1) {
      output += char;
    }

    console.info(output);
  },

  info(
    message,
    title = '',
    logError = false,
    _allowInProd = false,
    report = false
  ) {
    this.doLog(message, title, null, logError, report, false);
    console.info(title, message);
  },

  error(
    message,
    title = 'Log',
    logError = true,
    _allowInProd = false,
    report = true
  ) {
    this.doLog(message, title, null, logError, report, true);
    console.error(title, message);
  },

  doLog(
    message,
    title = null,
    customError = null,
    logError = true,
    report = true,
    isError = true
  ) {
    if (logError === false) {
      return null;
    }

    writeLog({
      message,
      title,
      customError,
      logError,
      report,
      isError,
    });

    return null;
  },
};
