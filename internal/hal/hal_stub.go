//go:build !linux

package hal

import (
	"fmt"
	"log"
	"runtime"
	"sync"
)

// DetectPlatform returns a stub platform on non-Linux systems.
func DetectPlatform() Platform {
	return Platform{
		Name:     "stub",
		Arch:     runtime.GOARCH,
		OS:       runtime.GOOS,
		I2CBuses: nil,
		HasGPIO:  false,
		HasPWM:   false,
	}
}

// OpenBus returns a simulated I2C bus that logs all operations.
func OpenBus(path string) (Bus, error) {
	log.Printf("[HAL-STUB] Opening simulated I2C bus (path=%q)", path)
	return &stubBus{name: "stub-i2c"}, nil
}

// ── Stub Bus ─────────────────────────────────────────────────────────

type stubBus struct {
	name string
	mu   sync.Mutex
}

func (b *stubBus) Name() string { return b.name }

func (b *stubBus) Open(addr uint16) (Device, error) {
	log.Printf("[HAL-STUB] Open device 0x%02X", addr)
	return &stubDevice{addr: addr}, nil
}

func (b *stubBus) Scan() ([]uint16, error) {
	log.Println("[HAL-STUB] I2C scan — returning simulated devices")
	// Return simulated Modulino addresses for dev/testing
	return []uint16{0x29, 0x3C, 0x44, 0x6A, 0x6C, 0x76, 0x7C}, nil
}

func (b *stubBus) Close() error {
	log.Println("[HAL-STUB] Bus closed")
	return nil
}

// ── Stub Device ──────────────────────────────────────────────────────

type stubDevice struct {
	addr uint16
	regs map[byte][]byte
}

func (d *stubDevice) Addr() uint16 { return d.addr }

func (d *stubDevice) Read(reg byte, buf []byte) error {
	log.Printf("[HAL-STUB] Read 0x%02X reg 0x%02X len %d", d.addr, reg, len(buf))
	// Return synthetic data for known Modulino sensors
	switch d.addr {
	case 0x29: // Distance: ~250mm
		if len(buf) >= 2 {
			buf[0] = 0x00
			buf[1] = 0xFA
		}
	case 0x44: // Thermo: ~22.5°C, ~45% RH
		if len(buf) >= 4 {
			buf[0] = 0x16 // temp MSB
			buf[1] = 0x80
			buf[2] = 0x2D // humidity MSB
			buf[3] = 0x00
		}
	case 0x6A: // IMU: near-zero accel (stationary)
		for i := range buf {
			buf[i] = 0
		}
	case 0x76: // Knob: position ~128
		if len(buf) >= 2 {
			buf[0] = 0x00
			buf[1] = 0x80
		}
	case 0x7C: // Buttons: none pressed
		if len(buf) >= 1 {
			buf[0] = 0x00
		}
	default:
		for i := range buf {
			buf[i] = 0xFF
		}
	}
	return nil
}

func (d *stubDevice) Write(reg byte, data []byte) error {
	log.Printf("[HAL-STUB] Write 0x%02X reg 0x%02X data %v", d.addr, reg, data)
	return nil
}

func (d *stubDevice) ReadByte(reg byte) (byte, error) {
	buf := make([]byte, 1)
	if err := d.Read(reg, buf); err != nil {
		return 0, err
	}
	return buf[0], nil
}

func (d *stubDevice) WriteByte(reg byte, val byte) error {
	return d.Write(reg, []byte{val})
}

func (d *stubDevice) ReadWord(reg byte) (uint16, error) {
	buf := make([]byte, 2)
	if err := d.Read(reg, buf); err != nil {
		return 0, err
	}
	return uint16(buf[0])<<8 | uint16(buf[1]), nil
}

func (d *stubDevice) WriteWord(reg byte, val uint16) error {
	return d.Write(reg, []byte{byte(val >> 8), byte(val & 0xFF)})
}

func (d *stubDevice) Close() error { return nil }

// ── Stub GPIO ────────────────────────────────────────────────────────

type StubGPIO struct{ Pin int }

func (g *StubGPIO) High() error              { log.Printf("[HAL-STUB] GPIO %d HIGH", g.Pin); return nil }
func (g *StubGPIO) Low() error               { log.Printf("[HAL-STUB] GPIO %d LOW", g.Pin); return nil }
func (g *StubGPIO) Read() (bool, error)      { return false, nil }
func (g *StubGPIO) SetDirection(bool) error   { return nil }
func (g *StubGPIO) Close() error             { return nil }

// OpenGPIO opens a stub GPIO pin.
func OpenGPIO(pin int) (GPIO, error) {
	return &StubGPIO{Pin: pin}, ErrNotSupported{Feature: fmt.Sprintf("GPIO pin %d", pin)}
}
