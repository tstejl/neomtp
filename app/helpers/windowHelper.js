import { urls } from 'nice-utils';
import { undefinedOrNull } from '../utils/funcs';
import { IS_RENDERER } from '../constants/env';

export const getCurrentWindowHash = () => {
  if (!IS_RENDERER) {
    return null;
  }

  const hash = urls().getHash();

  if (undefinedOrNull(hash) || hash === '') {
    return '/';
  }

  return hash;
};
