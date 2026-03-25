// Package hal provides hardware abstraction for MawdBot.
// Abstracts I2C, GPIO, SPI, and PWM so the same agent code runs on
// NVIDIA Orin Nano, Raspberry Pi, RISC-V boards, or a Mac (stub mode).
//
// Build tags control which backend is compiled:
//
//	linux   → real I2C via periph.io
//	!linux  → stub (logs only, no hardware)
package hal

import (
	"fmt"
	"time"
)

// ── Core Interfaces ──────────────────────────────────────────────────

// Bus is an I2C bus that can open device handles.
type Bus interface {
	// Open returns a device handle at the given 7-bit address.
	Open(addr uint16) (Device, error)
	// Scan probes all 7-bit addresses and returns those that ACK.
	Scan() ([]uint16, error)
	// Close releases the bus.
	Close() error
	// Name returns the bus identifier (e.g. "/dev/i2c-1").
	Name() string
}

// Device is a single I2C peripheral on the bus.
type Device interface {
	Read(reg byte, buf []byte) error
	Write(reg byte, data []byte) error
	ReadByte(reg byte) (byte, error)
	WriteByte(reg byte, val byte) error
	ReadWord(reg byte) (uint16, error)
	WriteWord(reg byte, val uint16) error
	Close() error
	Addr() uint16
}

// GPIO represents a single GPIO pin.
type GPIO interface {
	High() error
	Low() error
	Read() (bool, error)
	SetDirection(output bool) error
	Close() error
}

// PWM represents a PWM output channel.
type PWM interface {
	SetDuty(percent float64) error
	SetFreq(hz int) error
	Close() error
}

// ── Platform Info ────────────────────────────────────────────────────

// Platform describes the detected hardware environment.
type Platform struct {
	Name     string // "orin-nano", "rpi4", "riscv64", "stub"
	Arch     string // "arm64", "amd64", "riscv64"
	OS       string // "linux", "darwin", "windows"
	I2CBuses []string
	HasGPIO  bool
	HasPWM   bool
}

// ── Hardware Events ──────────────────────────────────────────────────

// Event represents a hardware sensor event routed to the agent.
type Event struct {
	Source    string    // "distance", "motion", "thermo", "button", "knob"
	Type      string    // "value", "threshold", "press", "release", "rotate"
	Value     float64
	RawBytes  []byte
	Timestamp time.Time
}

// EventHandler processes hardware events.
type EventHandler func(Event)

// ── Errors ───────────────────────────────────────────────────────────

type ErrBusNotFound struct{ Path string }

func (e ErrBusNotFound) Error() string {
	return fmt.Sprintf("hal: I2C bus not found: %s", e.Path)
}

type ErrDeviceNotResponding struct{ Addr uint16 }

func (e ErrDeviceNotResponding) Error() string {
	return fmt.Sprintf("hal: device 0x%02X not responding", e.Addr)
}

type ErrNotSupported struct{ Feature string }

func (e ErrNotSupported) Error() string {
	return fmt.Sprintf("hal: %s not supported on this platform", e.Feature)
}
