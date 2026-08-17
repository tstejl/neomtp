package mtpx

import "testing"

func TestPercent(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		partial float32
		total   float32
		want    float32
	}{
		{name: "half", partial: 5, total: 10, want: 50},
		{name: "complete", partial: 10, total: 10, want: 100},
		{name: "zero total", partial: 0, total: 0, want: 0},
		{name: "negative total", partial: 1, total: -1, want: 0},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := Percent(test.partial, test.total); got != test.want {
				t.Fatalf("Percent(%v, %v) = %v, want %v", test.partial, test.total, got, test.want)
			}
		})
	}
}

func TestPathHelpers(t *testing.T) {
	t.Parallel()

	if got := fixSlash("Pictures/../Documents/report.txt"); got != "/Documents/report.txt" {
		t.Fatalf("fixSlash returned %q", got)
	}

	parent, destination := mapSourcePathToDestinationPath(
		"/tmp/source/nested/report.txt",
		"/tmp/source",
		"/OpenMTP-Audit",
	)
	if parent != "/OpenMTP-Audit/nested" {
		t.Fatalf("destination parent = %q", parent)
	}
	if destination != "/OpenMTP-Audit/nested/report.txt" {
		t.Fatalf("destination path = %q", destination)
	}

	common := GetParentPath('/', "/Pictures/2026/a.jpg", "/Pictures/2026/b.jpg")
	if common != "/Pictures/2026" {
		t.Fatalf("common parent = %q", common)
	}
}

func TestFilenameHelpers(t *testing.T) {
	t.Parallel()

	if got := extension("backup.tar.gz", false); got != "tar.gz" {
		t.Fatalf("extension returned %q", got)
	}
	if got := extension("folder", true); got != "" {
		t.Fatalf("directory extension returned %q", got)
	}
	if got := SanitizeDosName(`report:*?"<>|.txt`); got != "report_______.txt" {
		t.Fatalf("SanitizeDosName returned %q", got)
	}
}
