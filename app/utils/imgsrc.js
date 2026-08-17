/* eslint global-require: off, prefer-template: off */

/**
 * handle image import into the program.
 * default path: ../public/images/
 * @param filePath
 * @param returnNoImageFound (optional)
 * @returns {*}
 */
export const imgsrc = (filePath, returnNoImageFound = true) => {
  try {
    return new URL(`images/${filePath}`, document.baseURI).href;
  } catch (e) {
    if (!returnNoImageFound) {
      return null;
    }

    return new URL('images/no-image.png', document.baseURI).href;
  }
};
