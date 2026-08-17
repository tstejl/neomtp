# Contributing to NeoMTP

NeoMTP began as a fork of [OpenMTP](https://github.com/ganeshrvel/openmtp). It is now detached and independent. Upstream and its maintainers do not support NeoMTP.

Use the [NeoMTP repository](https://github.com/tstejl/neomtp), [issue tracker](https://github.com/tstejl/neomtp/issues), and [release page](https://github.com/tstejl/neomtp/releases) for current project information.

## Before you start

- Search the [existing issues](https://github.com/tstejl/neomtp/issues) before opening a new one.
- For native MTP changes, read the provenance and license files under `ffi/kalam/native/`.
- Do not include personal files, device data, or unredacted logs in commits or issues.

## Development workflow

1. Clone the repository and create a topic branch from `main`.
2. Install the locked dependencies with `bun install --frozen-lockfile`.
3. Make a focused change and update documentation when behavior or commands change.
4. Run `bun run test`.
5. Run the relevant native Go tests when changing `ffi/kalam/native/`.
6. Open a pull request against `main` and explain the change, testing, and any device-specific limitations.

The repository uses Bun, Electron, electron-vite, React, and a vendored Go MTP module. See the [README](README.md) for the available build, test, packaging, and native-development commands.

## License

Contributions are accepted under the same [MIT License](https://github.com/tstejl/neomtp/blob/main/LICENSE) as NeoMTP. Historical attribution for the original OpenMTP project remains part of the project history.
