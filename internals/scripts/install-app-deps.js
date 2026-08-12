const { spawnSync } = require('child_process');

const electronBuilder =
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const env = { ...process.env };

// electron-builder 23 delegates native rebuilds to the package manager named by
// these variables. Bun exposes itself here, but Bun does not provide the npm
// compatible `rebuild` command that electron-builder expects.
delete env.npm_execpath;
delete env.npm_config_user_agent;

const result = spawnSync(electronBuilder, ['install-app-deps'], {
  env,
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status === null ? 1 : result.status;
