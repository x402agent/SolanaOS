// Package devices provides device/sensor management for MawdBot.
// Adapted from PicoClaw — I2C device registry for Arduino Modulino sensors.
package devices

import (
	"fmt"
	"sync"
)

type DeviceType string

const (
	TypeSensor   DeviceType = "sensor"
	TypeActuator DeviceType = "actuator"
	TypeDisplay  DeviceType = "display"
	TypeInput    DeviceType = "input"
)

type Device struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Type        DeviceType `json:"type"`
	I2CAddress  uint8      `json:"i2c_address"`
	Bus         int        `json:"bus"`
	Connected   bool       `json:"connected"`
	Description string     `json:"description"`
}

type DeviceRegistry struct {
	mu      sync.RWMutex
	devices map[string]*Device
}

func NewRegistry() *DeviceRegistry {
	return &DeviceRegistry{devices: make(map[string]*Device)}
}

func (r *DeviceRegistry) Register(dev *Device) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.devices[dev.ID] = dev
}

func (r *DeviceRegistry) Get(id string) (*Device, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	d, ok := r.devices[id]
	return d, ok
}

func (r *DeviceRegistry) List() []*Device {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*Device, 0, len(r.devices))
	for _, d := range r.devices {
		result = append(result, d)
	}
	return result
}

func (r *DeviceRegistry) Connected() []*Device {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []*Device
	for _, d := range r.devices {
		if d.Connected {
			result = append(result, d)
		}
	}
	return result
}

func (r *DeviceRegistry) SetConnected(id string, connected bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if d, ok := r.devices[id]; ok {
		d.Connected = connected
	}
}

// DefaultModulinoDevices returns the standard Modulino sensor set.
func DefaultModulinoDevices() []*Device {
	return []*Device{
		{ID: "distance", Name: "Modulino Distance", Type: TypeSensor, I2CAddress: 0x29, Description: "VL53L4CD ToF sensor"},
		{ID: "movement", Name: "Modulino Movement", Type: TypeSensor, I2CAddress: 0x6A, Description: "LSM6DSOX IMU"},
		{ID: "thermo", Name: "Modulino Thermo", Type: TypeSensor, I2CAddress: 0x44, Description: "HS3003 temp/humidity"},
		{ID: "knob", Name: "Modulino Knob", Type: TypeInput, I2CAddress: 0x76, Description: "PEC11J rotary encoder"},
		{ID: "buzzer", Name: "Modulino Buzzer", Type: TypeActuator, I2CAddress: 0x3C, Description: "PKLCS1212E piezo"},
		{ID: "pixels", Name: "Modulino Pixels", Type: TypeDisplay, I2CAddress: 0x6C, Description: "8x LC8822 RGB LEDs"},
		{ID: "buttons", Name: "Modulino Buttons", Type: TypeInput, I2CAddress: 0x7C, Description: "3x push + LEDs"},
	}
}

// FormatDeviceTable formats devices as a human-readable table.
func FormatDeviceTable(devices []*Device) string {
	result := fmt.Sprintf("%-12s %-20s %-10s %-6s %-9s\n", "ID", "Name", "Type", "Addr", "Status")
	result += "─────────────────────────────────────────────────────────\n"
	for _, d := range devices {
		status := "✗"
		if d.Connected { status = "✓" }
		result += fmt.Sprintf("%-12s %-20s %-10s 0x%02X   %s\n", d.ID, d.Name, d.Type, d.I2CAddress, status)
	}
	return result
}
