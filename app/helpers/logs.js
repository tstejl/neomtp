import { PATHS } from '../constants/paths';
import { undefinedOrNull } from '../utils/funcs';

/**
 * Description - Strip the user home directory path before writing local logs
 * @param s
 * @return {string|string}
 */
export const redactHomeDirectory = (s) => {
  if (undefinedOrNull(s)) {
    return '';
  }

  return (
    s?.toString()?.replaceAll(new RegExp(PATHS.homeDir, 'ig'), '/Users/user') ??
    ''
  );
};
