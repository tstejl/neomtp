/* eslint-disable no-console */

import assert from 'node:assert/strict';
import { loadMacPermissions } from '../app/helpers/macPermissions';

const permissions = await loadMacPermissions();

assert.strictEqual(typeof permissions.askForFoldersAccess, 'function');
assert.strictEqual(typeof permissions.askForPhotosAccess, 'function');

console.log('macOS permissions module interop passed');
