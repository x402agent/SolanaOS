package hal

import (
	"io"
	"testing"
)

// Regression for `go vet` (stdmethods): Device's per-register byte accessors
// were named ReadByte/WriteByte, which clash with io.ByteReader/ByteWriter.
func TestDeviceDoesNotShadowByteReaderWriter(t *testing.T) {
	var d Device
	if _, ok := d.(io.ByteReader); ok {
		t.Fatal("Device unexpectedly implements io.ByteReader")
	}
	if _, ok := d.(io.ByteWriter); ok {
		t.Fatal("Device unexpectedly implements io.ByteWriter")
	}
}
