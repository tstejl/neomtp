# MTP transport provenance

This package was extracted from
[`github.com/ganeshrvel/go-mtpfs/mtp`](https://github.com/ganeshrvel/go-mtpfs/tree/1c3302b3c476f69e787a0339122a804dd518a007/mtp)
at commit `1c3302b3c476f69e787a0339122a804dd518a007`.

OpenMTP copied only the MTP protocol and USB transport package.
OpenMTP did not copy the FUSE filesystem or the device-dependent upstream
tests. It retained `encoding_test.go` because that test runs without hardware.

The upstream New BSD license is preserved in this directory.
