## Initial setup

```shell
# Install Node.js 16 or later.
npm -g i nvm

# Use Node.js 16 or later.
nvm use 16

# Install zx.
npm -g i zx
```

```shell script
xcode-select --install
brew install llvm gcc pkg-config libusb
nano ~/.zshrc
```

Add these lines to `~/.zshrc`:

```shell
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
export LDFLAGS="-L/opt/homebrew/opt/llvm/lib"
export CPPFLAGS="-I/opt/homebrew/opt/llvm/include"
```

```shell
source ~/.zshrc
```


## Local MTP packages

OpenMTP keeps its MTP code in this module:

- `mtp` contains the MTP protocol and USB transport.
- `mtpx` contains the file operations that use `mtp`.

The module does not use the external `go-mtpfs` or `go-mtpx` modules.
Read each package's `PROVENANCE.md` file before you copy or publish its code.

## Build

Download the remaining Go dependencies:

```shell script
cd ffi/kalam/native
go mod download
```

Run the native tests:

```shell
cd ffi/kalam/native
go test ./...
```

Run the device test only with an unlocked device in File Transfer mode:

```shell
cd ffi/kalam/native
OPENMTP_MTP_DEVICE_TEST=1 go test ./mtpx -run TestDeviceRoundTrip -v
```

The device test uses a unique `OpenMTP-Audit-*` directory.
It removes this directory when the test ends.

Build the native binaries from the repository root:

```shell
cd </path/to/openmtp/>
zx ./ffi/kalam/native/scripts/build.mjs
```



## Troubleshooting

If the build reports `fatal error: 'stdlib.h' file not found xcode`, add this line to `~/.zshrc`:

```shell
export SDKROOT=$(xcrun --sdk macosx --show-sdk-path)
```

```shell
source ~/.zshrc
```





# Do not use the commands below. OpenMTP keeps them only for historical reference.

- Remove libusb `brew remove libusb`
- Download the required versions of the `libusb`.
  - Refer `Brew download for another OS version` for more
- Copy the `/path/to/libusb/arm64_big_sur/1.0.25/lib/libusb-1.0.0.dylib` to the `build/mac/bin/libusb.dylib`
- Make a backup copy of `/path/to/libusb/arm64_big_sur/1.0.25/lib/libusb-1.0.0.dylib`
- change the `rpath` using: `install_name_tool -id @loader_path/libusb.dylib /path/to/libusb/arm64_big_sur/1.0.25/lib/libusb-1.0.0.dylib`
- Open `/path/to/libusb/arm64_big_sur/1.0.25/lib/pkgconfig/libusb-1.0.pc`
  - Edit `prefix=@@HOMEBREW_CELLAR@@/libusb/1.0.25` as `prefix=/path/to/libusb/amd64_mojave/1.0.25`
  - Save it
- Example commands to build the kalam go binaries:

##### Examples:
```shell
(
        cd ./ffi/kalam/native && CGO_ENABLED=1 \
        PKG_CONFIG_PATH='/path/to/libusb/arm64_big_sur/1.0.25/lib/pkgconfig' \
        CGO_CFLAGS='-Wno-deprecated-declarations' \
        GOARCH=arm64 GOOS=darwin \
        go build \
        -v -a -trimpath \
        -o ../../../build/mac/bin/arm64/kalam.dylib -buildmode=c-shared ./*.go
    )
```

```shell
(
        cd ./ffi/kalam/native && CGO_ENABLED=1 \
        PKG_CONFIG_PATH='/path/to/libusb/arm64_big_sur/1.0.25/lib/pkgconfig' \
        CGO_CFLAGS='-Wno-deprecated-declarations' \
        GOARCH=arm64 GOOS=darwin \
        go build \
        -v -a -trimpath \
        -o ../../../build/mac/bin/arm64/kalam_debug_report kalam_debug_report/*.go
    )
```


## Do not follow the sections below anymore. These commands are deprecated
### libusb otool commands:

Build:
```shell
brew install libusb
brew info libusb
```

- Copy the path in the terminal; eg: `/opt/homebrew/Cellar/libusb/1.0.25`

```shell script
sudo install_name_tool -id "@loader_path/libusb.dylib" <libusb-path>/lib/libusb-1.0.0.dylib

# eg: sudo install_name_tool -id "@loader_path/libusb.dylib" /opt/homebrew/Cellar/libusb/1.0.25/lib/libusb-1.0.0.dylib

cp /opt/homebrew/Cellar/libusb/1.0.25/lib/libusb-1.0.dylib  ./build/mac/bin/libusb.dylib
```
