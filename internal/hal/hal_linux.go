//go:build linux

package hal

import (
	"fmt"
	"os"
	"strings"
	"sync"

	"periph.io/x/conn/v3/i2c"
	"periph.io/x/conn/v3/i2c/i2creg"
	"periph.io/x/host/v3"
)

var initOnce sync.Once

func initHost() error {
	var err error
	initOnce.Do(func() {
		_, err = host.Init()
	})
	return err
}

// DetectPlatform probes the running Linux system.
func DetectPlatform() Platform {
	p := Platform{
		OS:   "linux",
		Arch: detectArch(),
	}

	// Detect board type
	if data, err := os.ReadFile("/proc/device-tree/model"); err == nil {
		model := strings.TrimSpace(string(data))
		switch {
		case strings.Contains(model, "Orin Nano"):
			p.Name = "orin-nano"
		case strings.Contains(model, "Orin"):
			p.Name = "orin"
		case strings.Contains(model, "Raspberry Pi 5"):
			p.Name = "rpi5"
		case strings.Contains(model, "Raspberry Pi 4"):
			p.Name = "rpi4"
		case strings.Contains(model, "Raspberry Pi"):
			p.Name = "rpi"
		case strings.Contains(model, "VisionFive") || strings.Contains(model, "RISC-V"):
			p.Name = "riscv64"
		default:
			p.Name = "linux-generic"
		}
	} else {
		p.Name = "linux-generic"
	}

	// Enumerate I2C buses
	for i := 0; i < 8; i++ {
		path := fmt.Sprintf("/dev/i2c-%d", i)
		if _, err := os.Stat(path); err == nil {
			p.I2CBuses = append(p.I2CBuses, path)
		}
	}

	// GPIO available on most SBCs
	if _, err := os.Stat("/sys/class/gpio"); err == nil {
		p.HasGPIO = true
	}

	return p
}

// ── Linux I2C Bus ────────────────────────────────────────────────────

type linuxBus struct {
	bus    i2c.BusCloser
	name   string
	mu     sync.Mutex
	devs   map[uint16]*linuxDevice
}

// OpenBus opens an I2C bus by path or name.
// path: "/dev/i2c-1" or "" for auto-detect (first available).
func OpenBus(path string) (Bus, error) {
	if err := initHost(); err != nil {
		return nil, fmt.Errorf("hal: periph init: %w", err)
	}

	if path == "" {
		path = "" // periph auto-selects first bus
	}

	bus, err := i2creg.Open(path)
	if err != nil {
		return nil, ErrBusNotFound{Path: path}
	}

	name := path
	if name == "" {
		name = "(auto)"
	}

	return &linuxBus{
		bus:  bus,
		name: name,
		devs: make(map[uint16]*linuxDevice),
	}, nil
}

func (b *linuxBus) Name() string { return b.name }

func (b *linuxBus) Open(addr uint16) (Device, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if d, ok := b.devs[addr]; ok {
		return d, nil
	}

	dev := &i2c.Dev{Bus: b.bus, Addr: addr}

	// Probe: try reading 1 byte
	buf := make([]byte, 1)
	if err := dev.Tx(nil, buf); err != nil {
		return nil, ErrDeviceNotResponding{Addr: addr}
	}

	ld := &linuxDevice{dev: dev, addr: addr}
	b.devs[addr] = ld
	return ld, nil
}

func (b *linuxBus) Scan() ([]uint16, error) {
	var found []uint16
	buf := make([]byte, 1)

	for addr := uint16(0x08); addr <= 0x77; addr++ {
		dev := &i2c.Dev{Bus: b.bus, Addr: addr}
		if err := dev.Tx(nil, buf); err == nil {
			found = append(found, addr)
		}
	}
	return found, nil
}

func (b *linuxBus) Close() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.devs = nil
	return b.bus.Close()
}

// ── Linux I2C Device ─────────────────────────────────────────────────

type linuxDevice struct {
	dev  *i2c.Dev
	addr uint16
}

func (d *linuxDevice) Addr() uint16 { return d.addr }

func (d *linuxDevice) Read(reg byte, buf []byte) error {
	return d.dev.Tx([]byte{reg}, buf)
}

func (d *linuxDevice) Write(reg byte, data []byte) error {
	payload := append([]byte{reg}, data...)
	return d.dev.Tx(payload, nil)
}

func (d *linuxDevice) ReadByte(reg byte) (byte, error) {
	buf := make([]byte, 1)
	if err := d.Read(reg, buf); err != nil {
		return 0, err
	}
	return buf[0], nil
}

func (d *linuxDevice) WriteByte(reg byte, val byte) error {
	return d.Write(reg, []byte{val})
}

func (d *linuxDevice) ReadWord(reg byte) (uint16, error) {
	buf := make([]byte, 2)
	if err := d.Read(reg, buf); err != nil {
		return 0, err
	}
	return uint16(buf[0])<<8 | uint16(buf[1]), nil
}

func (d *linuxDevice) WriteWord(reg byte, val uint16) error {
	return d.Write(reg, []byte{byte(val >> 8), byte(val & 0xFF)})
}

func (d *linuxDevice) Close() error { return nil }

// ── Helpers ──────────────────────────────────────────────────────────

func detectArch() string {
	if data, err := os.ReadFile("/proc/cpuinfo"); err == nil {
		s := string(data)
		switch {
		case strings.Contains(s, "aarch64") || strings.Contains(s, "ARMv8"):
			return "arm64"
		case strings.Contains(s, "RISC-V"):
			return "riscv64"
		}
	}
	// Fallback
	return "arm64"
}
