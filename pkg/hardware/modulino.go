// Package hardware provides I2C communication with Arduino Modulino® sensors
// and actuators for the MawdBot Solana robot on NVIDIA Orin Nano.
//
// Modulino® nodes communicate over I2C (Qwiic connector):
//   - Movement (LSM6DSOX)  : 0x6A — pitch, roll, tilt
//   - Distance (VL53L4CD)  : 0x29 — time-of-flight proximity
//   - Thermo   (HS3003)    : 0x44 — temperature + humidity
//   - Knob     (PEC11J)    : 0x76 — rotary encoder via STM32
//   - Buzzer   (PKLCS1212) : 0x3C — tone generation via STM32
//   - Pixels   (LC8822)    : 0x6C — 8 RGB LEDs via STM32
//   - Buttons  (3x push)   : 0x7C — 3 buttons + 3 LEDs via STM32
package hardware

import (
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"sync"
	"syscall"
	"unsafe"
)

// ── I2C Bus ──────────────────────────────────────────────────────────

const (
	i2cSlave = 0x0703 // ioctl I2C_SLAVE
)

type I2CBus struct {
	mu   sync.Mutex
	fd   int
	path string
}

// OpenI2C opens an I2C bus device (e.g., /dev/i2c-1 on Orin Nano).
func OpenI2C(busNum int) (*I2CBus, error) {
	path := fmt.Sprintf("/dev/i2c-%d", busNum)
	fd, err := syscall.Open(path, syscall.O_RDWR, 0)
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	return &I2CBus{fd: fd, path: path}, nil
}

func (b *I2CBus) Close() error {
	return syscall.Close(b.fd)
}

func (b *I2CBus) setAddress(addr uint8) error {
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL,
		uintptr(b.fd), uintptr(i2cSlave), uintptr(addr))
	if errno != 0 {
		return fmt.Errorf("i2c set addr 0x%02X: %w", addr, errno)
	}
	return nil
}

func (b *I2CBus) ReadReg(addr uint8, reg uint8, buf []byte) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if err := b.setAddress(addr); err != nil {
		return err
	}

	// Write register address
	if _, err := syscall.Write(b.fd, []byte{reg}); err != nil {
		return fmt.Errorf("i2c write reg: %w", err)
	}

	// Read data
	if _, err := syscall.Read(b.fd, buf); err != nil {
		return fmt.Errorf("i2c read: %w", err)
	}
	return nil
}

func (b *I2CBus) WriteReg(addr uint8, reg uint8, data []byte) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if err := b.setAddress(addr); err != nil {
		return err
	}

	buf := make([]byte, 1+len(data))
	buf[0] = reg
	copy(buf[1:], data)

	if _, err := syscall.Write(b.fd, buf); err != nil {
		return fmt.Errorf("i2c write: %w", err)
	}
	return nil
}

func (b *I2CBus) Write(addr uint8, data []byte) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if err := b.setAddress(addr); err != nil {
		return err
	}
	if _, err := syscall.Write(b.fd, data); err != nil {
		return fmt.Errorf("i2c write: %w", err)
	}
	return nil
}

func (b *I2CBus) Read(addr uint8, buf []byte) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if err := b.setAddress(addr); err != nil {
		return err
	}
	if _, err := syscall.Read(b.fd, buf); err != nil {
		return fmt.Errorf("i2c read: %w", err)
	}
	return nil
}

// Scan probes all addresses 0x03-0x77 for responding devices.
func (b *I2CBus) Scan() []uint8 {
	var found []uint8
	for addr := uint8(0x03); addr <= 0x77; addr++ {
		b.mu.Lock()
		if err := b.setAddress(addr); err == nil {
			buf := make([]byte, 1)
			if _, err := syscall.Read(b.fd, buf); err == nil {
				found = append(found, addr)
			}
		}
		b.mu.Unlock()
	}
	return found
}

// ── Modulino® Distance (VL53L4CD) ───────────────────────────────────
// Time-of-flight proximity sensor. Default addr: 0x29

const AddrDistance = 0x29

type Distance struct {
	bus  *I2CBus
	addr uint8
}

func NewDistance(bus *I2CBus) *Distance {
	return &Distance{bus: bus, addr: AddrDistance}
}

func NewDistanceAddr(bus *I2CBus, addr uint8) *Distance {
	return &Distance{bus: bus, addr: addr}
}

// ReadMM returns distance in millimeters.
func (d *Distance) ReadMM() (uint16, error) {
	buf := make([]byte, 2)
	if err := d.bus.ReadReg(d.addr, 0x96, buf); err != nil {
		return 0, fmt.Errorf("distance read: %w", err)
	}
	return binary.BigEndian.Uint16(buf), nil
}

// Available checks if the sensor has new data ready.
func (d *Distance) Available() bool {
	buf := make([]byte, 1)
	if err := d.bus.ReadReg(d.addr, 0x89, buf); err != nil {
		return false
	}
	return buf[0]&0x01 != 0
}

// ── Modulino® Movement (LSM6DSOX) ───────────────────────────────────
// 6-axis IMU. Default addr: 0x6A

const AddrMovement = 0x6A

type Movement struct {
	bus  *I2CBus
	addr uint8
}

type MotionData struct {
	AccelX float64 `json:"accelX"` // g
	AccelY float64 `json:"accelY"`
	AccelZ float64 `json:"accelZ"`
	GyroX  float64 `json:"gyroX"` // dps
	GyroY  float64 `json:"gyroY"`
	GyroZ  float64 `json:"gyroZ"`
	Pitch  float64 `json:"pitch"` // degrees
	Roll   float64 `json:"roll"`
}

func NewMovement(bus *I2CBus) *Movement {
	return &Movement{bus: bus, addr: AddrMovement}
}

// Init configures the IMU for 104Hz output.
func (m *Movement) Init() error {
	// CTRL1_XL: ODR 104Hz, ±2g
	if err := m.bus.WriteReg(m.addr, 0x10, []byte{0x40}); err != nil {
		return err
	}
	// CTRL2_G: ODR 104Hz, 250dps
	return m.bus.WriteReg(m.addr, 0x11, []byte{0x40})
}

// Read returns accelerometer and gyroscope data with computed pitch/roll.
func (m *Movement) Read() (*MotionData, error) {
	buf := make([]byte, 12)
	if err := m.bus.ReadReg(m.addr, 0x22, buf); err != nil {
		return nil, fmt.Errorf("motion read: %w", err)
	}

	// Parse raw 16-bit signed values
	gx := float64(int16(binary.LittleEndian.Uint16(buf[0:2]))) * 8.75 / 1000.0   // dps
	gy := float64(int16(binary.LittleEndian.Uint16(buf[2:4]))) * 8.75 / 1000.0
	gz := float64(int16(binary.LittleEndian.Uint16(buf[4:6]))) * 8.75 / 1000.0
	ax := float64(int16(binary.LittleEndian.Uint16(buf[6:8]))) * 0.061 / 1000.0   // g
	ay := float64(int16(binary.LittleEndian.Uint16(buf[8:10]))) * 0.061 / 1000.0
	az := float64(int16(binary.LittleEndian.Uint16(buf[10:12]))) * 0.061 / 1000.0

	pitch := math.Atan2(ax, math.Sqrt(ay*ay+az*az)) * 180.0 / math.Pi
	roll := math.Atan2(ay, math.Sqrt(ax*ax+az*az)) * 180.0 / math.Pi

	return &MotionData{
		AccelX: ax, AccelY: ay, AccelZ: az,
		GyroX: gx, GyroY: gy, GyroZ: gz,
		Pitch: pitch, Roll: roll,
	}, nil
}

// ── Modulino® Thermo (HS3003) ────────────────────────────────────────
// Temperature + humidity sensor. Default addr: 0x44

const AddrThermo = 0x44

type Thermo struct {
	bus  *I2CBus
	addr uint8
}

type ThermoData struct {
	Temperature float64 `json:"temperature"` // °C
	Humidity    float64 `json:"humidity"`     // %RH
}

func NewThermo(bus *I2CBus) *Thermo {
	return &Thermo{bus: bus, addr: AddrThermo}
}

// Read triggers a measurement and returns temperature and humidity.
func (t *Thermo) Read() (*ThermoData, error) {
	// Trigger measurement
	if err := t.bus.Write(t.addr, []byte{0x00}); err != nil {
		return nil, err
	}

	// Wait for measurement (~33ms)
	buf := make([]byte, 4)
	if err := t.bus.Read(t.addr, buf); err != nil {
		return nil, fmt.Errorf("thermo read: %w", err)
	}

	// Parse humidity (14-bit) and temperature (14-bit)
	humRaw := (uint16(buf[0]) << 8 | uint16(buf[1])) >> 2
	tempRaw := (uint16(buf[2]) << 8 | uint16(buf[3])) >> 2

	humidity := float64(humRaw) / 16383.0 * 100.0
	temperature := float64(tempRaw)/16383.0*165.0 - 40.0

	return &ThermoData{
		Temperature: temperature,
		Humidity:    humidity,
	}, nil
}

// ── Modulino® Pixels (8x LC8822 RGB LEDs via STM32) ─────────────────
// Default addr: 0x6C

const AddrPixels = 0x6C

type Pixels struct {
	bus  *I2CBus
	addr uint8
	leds [8]RGB
}

type RGB struct {
	R uint8 `json:"r"`
	G uint8 `json:"g"`
	B uint8 `json:"b"`
}

func NewPixels(bus *I2CBus) *Pixels {
	return &Pixels{bus: bus, addr: AddrPixels}
}

// Set sets a single LED color (0-7).
func (p *Pixels) Set(index int, color RGB) {
	if index >= 0 && index < 8 {
		p.leds[index] = color
	}
}

// SetAll sets all LEDs to the same color.
func (p *Pixels) SetAll(color RGB) {
	for i := range p.leds {
		p.leds[i] = color
	}
}

// Clear turns off all LEDs.
func (p *Pixels) Clear() {
	p.SetAll(RGB{0, 0, 0})
	p.Show()
}

// Show writes current LED state to the hardware.
func (p *Pixels) Show() error {
	// Protocol: [cmd, r0, g0, b0, r1, g1, b1, ... r7, g7, b7]
	data := make([]byte, 1+8*3)
	data[0] = 0x01 // show command
	for i, led := range p.leds {
		data[1+i*3] = led.R
		data[1+i*3+1] = led.G
		data[1+i*3+2] = led.B
	}
	return p.bus.Write(p.addr, data)
}

// MawdBot status colors
var (
	ColorIdle    = RGB{0, 30, 0}      // dim green
	ColorRunning = RGB{20, 241, 149}  // neon green (#14F195)
	ColorSignal  = RGB{153, 69, 255}  // purple (#9945FF)
	ColorTrade   = RGB{0, 212, 255}   // teal (#00D4FF)
	ColorError   = RGB{255, 64, 96}   // red (#FF4060)
	ColorWin     = RGB{20, 241, 149}  // green
	ColorLoss    = RGB{255, 64, 96}   // red
)

// ShowStatus displays a status pattern on the 8 LEDs.
func (p *Pixels) ShowStatus(status string, value float64) error {
	switch status {
	case "idle":
		p.SetAll(ColorIdle)
	case "running":
		// Breathing green
		p.SetAll(ColorRunning)
	case "signal":
		// Purple flash
		p.SetAll(ColorSignal)
	case "trade":
		// Teal for active trade
		p.SetAll(ColorTrade)
	case "error":
		p.SetAll(ColorError)
	case "bar":
		// Progress bar (value 0.0-1.0)
		litCount := int(value * 8)
		for i := 0; i < 8; i++ {
			if i < litCount {
				p.leds[i] = ColorRunning
			} else {
				p.leds[i] = RGB{5, 5, 5}
			}
		}
	}
	return p.Show()
}

// ── Modulino® Buzzer (PKLCS1212E via STM32) ─────────────────────────
// Default addr: 0x3C

const AddrBuzzer = 0x3C

type Buzzer struct {
	bus  *I2CBus
	addr uint8
}

func NewBuzzer(bus *I2CBus) *Buzzer {
	return &Buzzer{bus: bus, addr: AddrBuzzer}
}

// Tone plays a frequency (Hz) for a duration (ms).
func (b *Buzzer) Tone(freqHz uint16, durationMs uint16) error {
	data := make([]byte, 5)
	data[0] = 0x01 // tone command
	binary.LittleEndian.PutUint16(data[1:3], freqHz)
	binary.LittleEndian.PutUint16(data[3:5], durationMs)
	return b.bus.Write(b.addr, data)
}

// Stop silences the buzzer.
func (b *Buzzer) Stop() error {
	return b.bus.Write(b.addr, []byte{0x00})
}

// MawdBot alert sounds
func (b *Buzzer) BeepSignal() error   { return b.Tone(1200, 100) }
func (b *Buzzer) BeepTrade() error    { return b.Tone(1800, 200) }
func (b *Buzzer) BeepWin() error      { return b.Tone(2400, 300) }
func (b *Buzzer) BeepLoss() error     { return b.Tone(400, 500) }
func (b *Buzzer) BeepError() error    { return b.Tone(200, 1000) }
func (b *Buzzer) BeepStartup() error  { return b.Tone(1000, 150) }

// ── Modulino® Buttons (3x push + 3x LED via STM32) ──────────────────
// Default addr: 0x7C

const AddrButtons = 0x7C

type Buttons struct {
	bus  *I2CBus
	addr uint8
}

type ButtonState struct {
	Button1 bool `json:"button1"`
	Button2 bool `json:"button2"`
	Button3 bool `json:"button3"`
	LED1    bool `json:"led1"`
	LED2    bool `json:"led2"`
	LED3    bool `json:"led3"`
}

func NewButtons(bus *I2CBus) *Buttons {
	return &Buttons{bus: bus, addr: AddrButtons}
}

// Read returns the current button and LED state.
func (b *Buttons) Read() (*ButtonState, error) {
	buf := make([]byte, 1)
	if err := b.bus.Read(b.addr, buf); err != nil {
		return nil, fmt.Errorf("buttons read: %w", err)
	}
	return &ButtonState{
		Button1: buf[0]&0x01 != 0,
		Button2: buf[0]&0x02 != 0,
		Button3: buf[0]&0x04 != 0,
		LED1:    buf[0]&0x08 != 0,
		LED2:    buf[0]&0x10 != 0,
		LED3:    buf[0]&0x20 != 0,
	}, nil
}

// SetLEDs controls the 3 button LEDs.
func (b *Buttons) SetLEDs(led1, led2, led3 bool) error {
	var val uint8
	if led1 { val |= 0x01 }
	if led2 { val |= 0x02 }
	if led3 { val |= 0x04 }
	return b.bus.Write(b.addr, []byte{0x01, val})
}

// ── Modulino® Knob (PEC11J rotary encoder via STM32) ─────────────────
// Default addr: 0x76

const AddrKnob = 0x76

type Knob struct {
	bus  *I2CBus
	addr uint8
}

type KnobState struct {
	Position int32 `json:"position"`
	Pressed  bool  `json:"pressed"`
}

func NewKnob(bus *I2CBus) *Knob {
	return &Knob{bus: bus, addr: AddrKnob}
}

// Read returns the knob position and button state.
func (k *Knob) Read() (*KnobState, error) {
	buf := make([]byte, 5)
	if err := k.bus.Read(k.addr, buf); err != nil {
		return nil, fmt.Errorf("knob read: %w", err)
	}
	pos := int32(binary.LittleEndian.Uint32(buf[0:4]))
	pressed := buf[4] != 0
	return &KnobState{Position: pos, Pressed: pressed}, nil
}

// Reset zeros the encoder position.
func (k *Knob) Reset() error {
	return k.bus.Write(k.addr, []byte{0x02, 0, 0, 0, 0})
}

// ── MawdBot Hardware Hub ─────────────────────────────────────────────
// Unified access to all Modulino sensors for the OODA loop.

type HardwareHub struct {
	Bus      *I2CBus
	Distance *Distance
	Movement *Movement
	Thermo   *Thermo
	Pixels   *Pixels
	Buzzer   *Buzzer
	Buttons  *Buttons
	Knob     *Knob

	available map[string]bool
}

// NewHardwareHub scans the I2C bus and initializes detected Modulino nodes.
func NewHardwareHub(busNum int) (*HardwareHub, error) {
	bus, err := OpenI2C(busNum)
	if err != nil {
		return nil, err
	}

	hub := &HardwareHub{
		Bus:       bus,
		available: make(map[string]bool),
	}

	// Scan for devices
	devices := bus.Scan()
	for _, addr := range devices {
		switch addr {
		case AddrDistance:
			hub.Distance = NewDistance(bus)
			hub.available["distance"] = true
		case AddrMovement:
			hub.Movement = NewMovement(bus)
			hub.available["movement"] = true
			hub.Movement.Init()
		case AddrThermo:
			hub.Thermo = NewThermo(bus)
			hub.available["thermo"] = true
		case AddrPixels:
			hub.Pixels = NewPixels(bus)
			hub.available["pixels"] = true
		case AddrBuzzer:
			hub.Buzzer = NewBuzzer(bus)
			hub.available["buzzer"] = true
		case AddrButtons:
			hub.Buttons = NewButtons(bus)
			hub.available["buttons"] = true
		case AddrKnob:
			hub.Knob = NewKnob(bus)
			hub.available["knob"] = true
		}
	}

	return hub, nil
}

func (h *HardwareHub) Close() error {
	if h.Pixels != nil {
		h.Pixels.Clear()
	}
	return h.Bus.Close()
}

func (h *HardwareHub) IsAvailable(sensor string) bool {
	return h.available[sensor]
}

func (h *HardwareHub) ListAvailable() []string {
	var result []string
	for k := range h.available {
		result = append(result, k)
	}
	return result
}

// GetEnvironment returns a snapshot of all sensor readings.
func (h *HardwareHub) GetEnvironment() map[string]interface{} {
	env := make(map[string]interface{})

	if h.Distance != nil {
		if mm, err := h.Distance.ReadMM(); err == nil {
			env["distance_mm"] = mm
		}
	}

	if h.Movement != nil {
		if data, err := h.Movement.Read(); err == nil {
			env["motion"] = data
		}
	}

	if h.Thermo != nil {
		if data, err := h.Thermo.Read(); err == nil {
			env["thermo"] = data
		}
	}

	if h.Knob != nil {
		if state, err := h.Knob.Read(); err == nil {
			env["knob"] = state
		}
	}

	if h.Buttons != nil {
		if state, err := h.Buttons.Read(); err == nil {
			env["buttons"] = state
		}
	}

	return env
}

// Suppress unused import warnings
var _ = unsafe.Sizeof(0)
var _ = os.DevNull
