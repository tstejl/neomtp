package mtpx

import (
	"bytes"
	"crypto/sha256"
	"errors"
	"fmt"
	"kalam/mtp"
	"os"
	"path/filepath"
	"testing"
	"time"
)

const deviceTestEnvironment = "NEOMTP_MTP_DEVICE_TEST"

// TestDeviceRoundTrip operates only when NEOMTP_MTP_DEVICE_TEST=1.
// It creates and removes one unique directory in the selected device storage.
func TestDeviceRoundTrip(t *testing.T) {
	if os.Getenv(deviceTestEnvironment) != "1" {
		t.Skip("set NEOMTP_MTP_DEVICE_TEST=1 to run the MTP device test")
	}

	dev, err := Initialize(Init{})
	if err != nil {
		t.Fatalf("initialize device: %v", err)
	}
	deviceOpen := true
	t.Cleanup(func() {
		if deviceOpen {
			Dispose(dev)
		}
	})

	if _, err := FetchDeviceInfo(dev); err != nil {
		t.Fatalf("fetch device info: %v", err)
	}

	storages, err := FetchStorages(dev)
	if err != nil {
		t.Fatalf("fetch storages: %v", err)
	}
	storageID := selectTestStorage(storages)
	remoteRoot := fmt.Sprintf("/NeoMTP-Audit-%d", time.Now().UnixNano())

	t.Cleanup(func() {
		if deviceOpen {
			if err := DeleteFile(dev, storageID, []FileProp{{FullPath: remoteRoot}}); err != nil {
				t.Logf("remove device test directory %s: %v", remoteRoot, err)
			}
		}
	})

	if _, _, _, err := Walk(dev, storageID, "/", false, false, false, validWalkEntry); err != nil {
		t.Fatalf("list storage root: %v", err)
	}

	firstID, err := MakeDirectory(dev, storageID, remoteRoot)
	if err != nil {
		t.Fatalf("create device test directory: %v", err)
	}
	secondID, err := MakeDirectory(dev, storageID, remoteRoot)
	if err != nil {
		t.Fatalf("reuse device test directory: %v", err)
	}
	if firstID == 0 || firstID != secondID {
		t.Fatalf("directory IDs differ: %d and %d", firstID, secondID)
	}

	localRoot := t.TempDir()
	single := writeFixture(t, localRoot, "single.txt", []byte("NeoMTP single-file test\n"))
	multiA := writeFixture(t, localRoot, "multi-a.txt", bytes.Repeat([]byte("multiple-file-test\n"), 97))
	multiB := writeFixture(t, localRoot, "multi-b.bin", deterministicFixture(1024*1024+333))
	treeFile := writeFixture(t, localRoot, "tree/nested/tree.txt", []byte("nested tree test\n"))

	uploadAndRequireTotals(t, dev, storageID, []string{single}, remoteRoot, 1)
	uploadAndRequireTotals(t, dev, storageID, []string{multiA, multiB}, remoteRoot, 2)
	uploadAndRequireTotals(t, dev, storageID, []string{filepath.Join(localRoot, "tree")}, remoteRoot, 1)

	wantSizes := map[string]int64{
		remoteRoot + "/single.txt":           fileSize(t, single),
		remoteRoot + "/multi-a.txt":          fileSize(t, multiA),
		remoteRoot + "/multi-b.bin":          fileSize(t, multiB),
		remoteRoot + "/tree/nested/tree.txt": fileSize(t, treeFile),
	}
	gotSizes := make(map[string]int64)
	_, _, _, err = Walk(dev, storageID, remoteRoot, true, false, false, func(_ uint32, info *FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir {
			gotSizes[info.FullPath] = info.Size
		}
		return nil
	})
	if err != nil {
		t.Fatalf("list device test directory: %v", err)
	}
	for path, want := range wantSizes {
		if got, ok := gotSizes[path]; !ok || got != want {
			t.Fatalf("device object %q has size %d, present=%t, want %d", path, got, ok, want)
		}
	}

	singleDestination := filepath.Join(localRoot, "download-single")
	downloadAndRequireTotals(t, dev, storageID, []string{remoteRoot + "/single.txt"}, singleDestination, 1)
	requireSameFile(t, single, filepath.Join(singleDestination, "single.txt"))

	multipleDestination := filepath.Join(localRoot, "download-multiple")
	downloadAndRequireTotals(t, dev, storageID, []string{
		remoteRoot + "/multi-a.txt",
		remoteRoot + "/multi-b.bin",
	}, multipleDestination, 2)
	requireSameFile(t, multiA, filepath.Join(multipleDestination, "multi-a.txt"))
	requireSameFile(t, multiB, filepath.Join(multipleDestination, "multi-b.bin"))

	treeDestination := filepath.Join(localRoot, "download-tree")
	downloadAndRequireTotals(t, dev, storageID, []string{remoteRoot + "/tree"}, treeDestination, 1)
	requireSameFile(t, treeFile, filepath.Join(treeDestination, "tree/nested/tree.txt"))

	oldPath := remoteRoot + "/multi-a.txt"
	newPath := remoteRoot + "/multi-a-renamed.txt"
	if _, err := RenameFile(dev, storageID, FileProp{FullPath: oldPath}, "multi-a-renamed.txt"); err != nil {
		t.Fatalf("rename device file: %v", err)
	}
	existence, err := FileExists(dev, storageID, []FileProp{{FullPath: oldPath}, {FullPath: newPath}})
	if err != nil {
		t.Fatalf("check renamed device file: %v", err)
	}
	if len(existence) != 2 || existence[0].Exists || !existence[1].Exists {
		t.Fatalf("unexpected rename state: %#v", existence)
	}

	if err := DeleteFile(dev, storageID, []FileProp{{FullPath: remoteRoot}}); err != nil {
		t.Fatalf("remove device test directory: %v", err)
	}
	existence, err = FileExists(dev, storageID, []FileProp{{FullPath: remoteRoot}})
	if err != nil {
		t.Fatalf("check removed device test directory: %v", err)
	}
	if len(existence) != 1 || existence[0].Exists {
		t.Fatalf("device test directory still exists: %#v", existence)
	}

	Dispose(dev)
	deviceOpen = false

	reopened, err := Initialize(Init{})
	if err != nil {
		t.Fatalf("reconnect device: %v", err)
	}
	defer Dispose(reopened)
	if _, err := FetchStorages(reopened); err != nil {
		t.Fatalf("fetch storages after reconnect: %v", err)
	}
}

func selectTestStorage(storages []StorageData) uint32 {
	selected := storages[0]
	for _, storage := range storages[1:] {
		if storage.Info.FreeSpaceInBytes > selected.Info.FreeSpaceInBytes {
			selected = storage
		}
	}
	return selected.Sid
}

func validWalkEntry(_ uint32, info *FileInfo, err error) error {
	if err != nil {
		return err
	}
	if info == nil || info.ObjectId == 0 || info.Name == "" {
		return errors.New("storage listing contains an invalid entry")
	}
	return nil
}

func writeFixture(t *testing.T, root, name string, data []byte) string {
	t.Helper()
	path := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("create fixture directory: %v", err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("write fixture %s: %v", name, err)
	}
	return path
}

func deterministicFixture(size int) []byte {
	data := make([]byte, size)
	for index := range data {
		data[index] = byte((index*31 + index/251 + 17) % 256)
	}
	return data
}

func fileSize(t *testing.T, path string) int64 {
	t.Helper()
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("read fixture size %s: %v", path, err)
	}
	return info.Size()
}

func uploadAndRequireTotals(t *testing.T, dev *mtp.Device, storageID uint32, sources []string, destination string, wantFiles int64) {
	t.Helper()
	_, files, _, err := UploadFiles(dev, storageID, sources, destination, true, localPreprocess, validProgress)
	if err != nil {
		t.Fatalf("upload %v: %v", sources, err)
	}
	if files != wantFiles {
		t.Fatalf("uploaded file count = %d, want %d", files, wantFiles)
	}
}

func downloadAndRequireTotals(t *testing.T, dev *mtp.Device, storageID uint32, sources []string, destination string, wantFiles int64) {
	t.Helper()
	files, _, err := DownloadFiles(dev, storageID, sources, destination, true, mtpPreprocess, validProgress)
	if err != nil {
		t.Fatalf("download %v: %v", sources, err)
	}
	if files != wantFiles {
		t.Fatalf("downloaded file count = %d, want %d", files, wantFiles)
	}
}

func localPreprocess(_ *os.FileInfo, _ string, err error) error {
	return err
}

func mtpPreprocess(_ *FileInfo, err error) error {
	return err
}

func validProgress(progress *ProgressInfo, err error) error {
	if err != nil {
		return err
	}
	if progress == nil || progress.ActiveFileSize == nil || progress.BulkFileSize == nil {
		return errors.New("transfer progress is incomplete")
	}
	if progress.Status == Completed {
		return nil
	}
	if progress.FileInfo == nil {
		return errors.New("transfer progress has no file")
	}
	if progress.ActiveFileSize.Sent < 0 || progress.ActiveFileSize.Sent > progress.ActiveFileSize.Total {
		return fmt.Errorf("invalid file progress: %d of %d", progress.ActiveFileSize.Sent, progress.ActiveFileSize.Total)
	}
	if progress.BulkFileSize.Total > 0 && progress.BulkFileSize.Sent > progress.BulkFileSize.Total {
		return fmt.Errorf("invalid total progress: %d of %d", progress.BulkFileSize.Sent, progress.BulkFileSize.Total)
	}
	return nil
}

func requireSameFile(t *testing.T, wantPath, gotPath string) {
	t.Helper()
	want, err := os.ReadFile(wantPath)
	if err != nil {
		t.Fatalf("read source file %s: %v", wantPath, err)
	}
	got, err := os.ReadFile(gotPath)
	if err != nil {
		t.Fatalf("read downloaded file %s: %v", gotPath, err)
	}
	wantHash := sha256.Sum256(want)
	gotHash := sha256.Sum256(got)
	if wantHash != gotHash {
		t.Fatalf("checksum mismatch: %s and %s", wantPath, gotPath)
	}
}
