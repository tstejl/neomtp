# NeoMTP native MTP module

This module contains the native MTP implementation used by NeoMTP:

- `mtp` provides the MTP protocol and USB transport.
- `mtpx` provides file operations that use `mtp`.

The code is stored in this repository. It does not load the external
`go-mtpfs` or `go-mtpx` modules at build time. Read each package's
`PROVENANCE.md` file before you copy or publish its code.

## Prerequisites

Install the Xcode command-line tools, Go, Bun, and the root project
dependencies. The native build also requires `libusb` and `pkg-config`.

```shell
xcode-select --install
brew install go libusb pkg-config
bun install --frozen-lockfile
```

## Test

Run the tests that do not require hardware:

```shell
cd ffi/kalam/native
go mod download
go test ./...
```

Run the device integration test only when an unlocked Android device is in
File Transfer mode:

```shell
cd ffi/kalam/native
NEOMTP_MTP_DEVICE_TEST=1 go test ./mtpx -run TestDeviceRoundTrip -v
```

The device test creates a unique `NeoMTP-Audit-*` directory on the device.
It removes that directory when the test ends.

## Build

From the repository root, build the native libraries and helper binaries:

```shell
bun run dev-kalam-ffi
```

That command rebuilds the native artifacts and starts the Electron development
application. To rebuild only the native artifacts, run:

```shell
bunx zx ./ffi/kalam/native/scripts/build.mjs
```

If the compiler cannot find `stdlib.h`, set the active macOS SDK:

```shell
export SDKROOT="$(xcrun --sdk macosx --show-sdk-path)"
```
