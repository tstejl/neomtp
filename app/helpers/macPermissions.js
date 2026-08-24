export async function loadMacPermissions() {
  const permissionsModule = await import(
    // eslint-disable-next-line import/no-unresolved
    'node-mac-permissions'
  );

  return permissionsModule.default ?? permissionsModule;
}
