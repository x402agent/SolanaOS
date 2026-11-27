//go:build !linux

package hal

var _ Device = (*stubDevice)(nil)
