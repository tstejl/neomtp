# NeoMTP

NeoMTP is a macOS desktop application for browsing and transferring files between a Mac and Android or other MTP devices.

> NeoMTP began as a fork of [OpenMTP](https://github.com/ganeshrvel/openmtp).
> It is now detached and independent.
> NeoMTP is maintained at [github.com/tstejl/neomtp](https://github.com/tstejl/neomtp). Upstream and its maintainers do not support NeoMTP.

## Current scope

- macOS 11 (Big Sur) or later
- Android and other devices that expose storage through MTP
- Apple silicon and Intel Macs
- Local browsing and device browsing in split-pane views
- Single-file and multi-file transfers
- File and folder operations, drag and drop, and grid or list views

The project is under active development. See the [repository](https://github.com/tstejl/neomtp), [issues](https://github.com/tstejl/neomtp/issues), and [releases](https://github.com/tstejl/neomtp/releases) for current status. The repository lists supported builds and known limitations.

## Installation

Use a packaged build from the [NeoMTP releases page](https://github.com/tstejl/neomtp/releases) when one is available.
Otherwise, build from source below. No Homebrew package is documented in this fork.

## Development prerequisites

- macOS 11 or later
- [Node.js 22.12 or later](https://nodejs.org/en/download/)
- [Bun 1.3.11](https://bun.sh/docs/installation)
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Go](https://go.dev/doc/install/) and Xcode Command Line Tools for native MTP work

The native build may require platform libraries. Read [`ffi/kalam/native/README.md`](ffi/kalam/native/README.md) before changing or rebuilding it.

## Build and run

```shell
git clone https://github.com/tstejl/neomtp.git
cd neomtp
bun install --frozen-lockfile
```

Run the development application:

```shell
bun run dev
```

If a fresh checkout reports missing or undefined extension state, run the development command once with the extension upgrade flag:

```shell
UPGRADE_EXTENSIONS=1 bun run dev
```

Other useful commands:

```shell
# Lint and build the main, preload, and renderer bundles.
bun run build

# Build without the lint step.
bun run build-no-verify

# Build and run the production application locally.
bun run start

# Create a local macOS package without notarization.
bun run package-mac-without-notarize
```

## Tests

The default test command runs smoke checks, the preload transfer-race test, and the no-device Electron end-to-end test:

```shell
bun run test
```

Focused commands are available for the following cases:

```shell
bun run test:smoke
bun run test:preload
bun run test:e2e:no-device
bun run test:e2e:device
bun run test:e2e:device-ui
bun run test:e2e:packaged-device
```

Device tests require an unlocked MTP device in File Transfer mode.
The packaged-device test also requires a packaged application.
Do not use a device that contains data you cannot restore.

For native MTP tests:

```shell
cd ffi/kalam/native
go test ./...
```

The native device test is opt-in. Read [`ffi/kalam/native/README.md`](ffi/kalam/native/README.md) for its environment variable and device requirements.

## Repository layout

- `app/` contains the Electron main process, preload bridge, and React renderer.
- `ffi/kalam/` contains the JavaScript native bridge.
- `ffi/kalam/native/` contains the vendored Go module, including the `mtp`, `mtpx`, and `send_to_js` packages.
- `scripts/` contains smoke checks and Electron end-to-end tests.
- `docs-sources/` contains the documentation site source.
- `electron-builder-config.js` contains packaging configuration.

The desktop bundles use [electron-vite](https://electron-vite.org/). `package.json` records Electron 43 and React 17. Bun is the package manager and script runner.

## Contributions

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a change. Use the [NeoMTP issue tracker](https://github.com/tstejl/neomtp/issues) for bugs and proposals, and submit pull requests to the `main` branch.

## Attribution and license

NeoMTP retains historical code and attribution from OpenMTP.
Ganesh Rathinavel created the original OpenMTP project.
This fork and the original project use the [MIT License](https://github.com/tstejl/neomtp/blob/main/LICENSE).
Vendored native packages include their own provenance and license files.
Keep those files with any redistributed code.
