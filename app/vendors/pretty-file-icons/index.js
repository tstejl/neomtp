import extensions from './index.json';

const unknown = extensions[''];

function isString(value) {
  return (
    typeof value === 'string' ||
    Object.prototype.toString.call(value) === '[object String]'
  );
}

function getIcon(filename, type) {
  // Extract extension from the filename
  var ext = '';

  if (isString(filename)) {
    var filenameString = filename.toString();
    var lastDot = filenameString.lastIndexOf('.');
    var lastSlash = Math.max(
      filenameString.lastIndexOf('/'),
      filenameString.lastIndexOf('\\')
    );

    if (lastDot > lastSlash && lastDot > 0) {
      ext = filenameString.slice(lastDot).toLowerCase();
    }
  }

  // Validate type - it should be 'svg' or '.svg'
  type = isString(type) ? type.toLowerCase() : '';
  if (type.charAt(0) === '.') {
    type = type.substr(1, type.length);
  }
  if (['svg'].indexOf(type) >= 0) {
    type = '.' + type;
  } else {
    type = '';
  }

  return (extensions[ext] || unknown) + type;
}

export default {
  getIcon,
  unknown,
  extensions,
};
