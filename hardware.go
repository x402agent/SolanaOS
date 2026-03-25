package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"github.com/x402agent/Solana-Os-Go/pkg/hardware"
)

// NewHardwareCommand builds the `solanaos hardware` subcommand tree.
func NewHardwareCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "hardware",
		Short: "Arduino Modulino® I2C hardware control",
		Long: `Control and inspect the Arduino Modulino® sensor cluster connected
to the NVIDIA Orin Nano (or any Linux I2C-capable device) via Qwiic/I2C.

Modulino® nodes (all I2C):
  0x29  Distance  VL53L4CD ToF     proximity (mm)
  0x3C  Buzzer    PKLCS1212E       tone generation
  0x44  Thermo    HS3003            temperature + humidity
  0x6A  Movement  LSM6DSOX IMU     6-axis motion
  0x6C  Pixels    LC8822 × 8       RGB LEDs
  0x76  Knob      PEC11J encoder   rotary + press
  0x7C  Buttons   3× push + LED    control buttons`,
	}

	cmd.AddCommand(
		NewHardwareScanCommand(),
		NewHardwareTestCommand(),
		NewHardwareMonitorCommand(),
		NewHardwareDemoCommand(),
	)

	return cmd
}

// ── Scan ─────────────────────────────────────────────────────────────

func NewHardwareScanCommand() *cobra.Command {
	var busNum int

	cmd := &cobra.Command{
		Use:   "scan",
		Short: "Scan I2C bus for Modulino® sensors",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("%s🔍 Scanning I2C bus %d for Modulino® sensors...%s\n\n",
				colorTeal, busNum, colorReset)

			hub, err := hardware.OpenI2C(busNum)
			if err != nil {
				return fmt.Errorf("cannot open I2C bus %d: %w\n\nHint: check /dev/i2c-%d exists and you have permission.\nTry: sudo usermod -aG i2c $USER", busNum, err, busNum)
			}
			defer hub.Close()

			addrs := hub.Scan()

			modulinoMap := map[uint8]struct {
				name   string
				sensor string
				use    string
			}{
				0x29: {"Distance", "VL53L4CD", "Proximity alerts"},
				0x3C: {"Buzzer", "PKLCS1212E", "Audio alerts"},
				0x44: {"Thermo", "HS3003", "Environment logging"},
				0x6A: {"Movement", "LSM6DSOX", "Tilt / motion detection"},
				0x6C: {"Pixels", "LC8822×8", "Status display"},
				0x76: {"Knob", "PEC11J", "RSI param tuning"},
				0x7C: {"Buttons", "3× push", "Cycle trigger / mode toggle / E-stop"},
			}

			if len(addrs) == 0 {
				fmt.Printf("%s✗ No I2C devices found on bus %d%s\n", colorRed, busNum, colorReset)
				fmt.Printf("%sCheck connections and ensure Qwiic cable is seated.%s\n", colorDim, colorReset)
				return nil
			}

			fmt.Printf("Found %s%d devices%s:\n\n", colorGreen, len(addrs), colorReset)
			fmt.Printf("  %-8s %-12s %-14s %-20s %s\n", "Addr", "Modulino", "Sensor", "Runtime Role", "Status")
			fmt.Printf("  %s\n", "─────────────────────────────────────────────────────────────────")

			recognized := 0
			for _, addr := range addrs {
				if info, ok := modulinoMap[addr]; ok {
					fmt.Printf("  %s0x%02X%s     %-12s %-14s %-20s %s✓ OK%s\n",
						colorGreen, addr, colorReset,
						info.name, info.sensor, info.use,
						colorGreen, colorReset)
					recognized++
				} else {
					fmt.Printf("  %s0x%02X%s     %-12s %-14s %s\n",
						colorAmber, addr, colorReset,
						"Unknown", "–",
						colorDim+"(not a Modulino)"+colorReset)
				}
			}

			fmt.Printf("\n  %sRecognized: %d/%d Modulino® nodes%s\n",
				colorGreen, recognized, len(addrs), colorReset)

			missing := []uint8{}
			for addr := range modulinoMap {
				found := false
				for _, a := range addrs {
					if a == addr {
						found = true
						break
					}
				}
				if !found {
					missing = append(missing, addr)
				}
			}

			if len(missing) > 0 {
				fmt.Printf("\n  %sNot found:%s", colorDim, colorReset)
				for _, addr := range missing {
					info := modulinoMap[addr]
					fmt.Printf(" %s(0x%02X)", info.name, addr)
				}
				fmt.Println()
			}

			return nil
		},
	}

	cmd.Flags().IntVarP(&busNum, "bus", "b", 1, "I2C bus number (e.g. 1 = /dev/i2c-1)")
	return cmd
}

// ── Test ─────────────────────────────────────────────────────────────

func NewHardwareTestCommand() *cobra.Command {
	var busNum int

	cmd := &cobra.Command{
		Use:   "test",
		Short: "Run hardware self-test (LEDs, buzzer, sensors)",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("%s🧪 SolanaOS Hardware Self-Test%s\n\n", colorGreen, colorReset)

			hub, err := hardware.NewHardwareHub(busNum)
			if err != nil {
				return fmt.Errorf("hardware init: %w", err)
			}
			defer hub.Close()

			sensors := hub.ListAvailable()
			if len(sensors) == 0 {
				fmt.Printf("%s✗ No sensors detected on bus %d%s\n", colorRed, busNum, colorReset)
				return nil
			}

			fmt.Printf("Detected: %s%v%s\n\n", colorGreen, sensors, colorReset)

			pass := 0
			fail := 0

			testResult := func(name string, err error) {
				if err != nil {
					fmt.Printf("  %s✗%s %-12s %s%v%s\n", colorRed, colorReset, name, colorDim, err, colorReset)
					fail++
				} else {
					fmt.Printf("  %s✓%s %-12s OK\n", colorGreen, colorReset, name)
					pass++
				}
			}

			// Pixels test
			if hub.IsAvailable("pixels") {
				colors := []hardware.RGB{
					hardware.ColorRunning,
					hardware.ColorSignal,
					hardware.ColorTrade,
					hardware.ColorWin,
					hardware.ColorLoss,
					hardware.ColorError,
				}
				for _, c := range colors {
					hub.Pixels.SetAll(c)
					hub.Pixels.Show()
					time.Sleep(200 * time.Millisecond)
				}
				hub.Pixels.Clear()
				testResult("pixels", nil)
			}

			// Buzzer test
			if hub.IsAvailable("buzzer") {
				notes := []struct{ freq uint16 }{
					{880}, {1047}, {1319}, {1568},
				}
				for _, n := range notes {
					hub.Buzzer.Tone(n.freq, 120)
					time.Sleep(150 * time.Millisecond)
				}
				hub.Buzzer.Stop()
				testResult("buzzer", nil)
			}

			// Thermo test
			if hub.IsAvailable("thermo") {
				data, err := hub.Thermo.Read()
				if err == nil {
					fmt.Printf("  %s✓%s %-12s %.1f°C  %.1f%%RH\n",
						colorGreen, colorReset, "thermo", data.Temperature, data.Humidity)
					pass++
				} else {
					testResult("thermo", err)
				}
			}

			// Distance test
			if hub.IsAvailable("distance") {
				mm, err := hub.Distance.ReadMM()
				if err == nil {
					fmt.Printf("  %s✓%s %-12s %dmm\n", colorGreen, colorReset, "distance", mm)
					pass++
				} else {
					testResult("distance", err)
				}
			}

			// Motion test
			if hub.IsAvailable("movement") {
				data, err := hub.Movement.Read()
				if err == nil {
					fmt.Printf("  %s✓%s %-12s pitch=%.1f° roll=%.1f°\n",
						colorGreen, colorReset, "movement", data.Pitch, data.Roll)
					pass++
				} else {
					testResult("movement", err)
				}
			}

			// Knob test
			if hub.IsAvailable("knob") {
				state, err := hub.Knob.Read()
				if err == nil {
					fmt.Printf("  %s✓%s %-12s pos=%d pressed=%v\n",
						colorGreen, colorReset, "knob", state.Position, state.Pressed)
					pass++
				} else {
					testResult("knob", err)
				}
			}

			// Buttons test
			if hub.IsAvailable("buttons") {
				state, err := hub.Buttons.Read()
				if err == nil {
					fmt.Printf("  %s✓%s %-12s [%v %v %v]\n",
						colorGreen, colorReset, "buttons",
						state.Button1, state.Button2, state.Button3)
					pass++
				} else {
					testResult("buttons", err)
				}
			}

			fmt.Printf("\n%s%d passed%s  %s%d failed%s\n",
				colorGreen, pass, colorReset,
				colorRed, fail, colorReset)

			// Final status flash
			if hub.IsAvailable("pixels") {
				if fail == 0 {
					for i := 0; i < 3; i++ {
						hub.Pixels.SetAll(hardware.ColorWin)
						hub.Pixels.Show()
						time.Sleep(200 * time.Millisecond)
						hub.Pixels.Clear()
						time.Sleep(100 * time.Millisecond)
					}
				} else {
					hub.Pixels.SetAll(hardware.ColorError)
					hub.Pixels.Show()
					time.Sleep(500 * time.Millisecond)
					hub.Pixels.Clear()
				}
			}

			return nil
		},
	}

	cmd.Flags().IntVarP(&busNum, "bus", "b", 1, "I2C bus number")
	return cmd
}

// ── Monitor ──────────────────────────────────────────────────────────

func NewHardwareMonitorCommand() *cobra.Command {
	var busNum int
	var interval int

	cmd := &cobra.Command{
		Use:   "monitor",
		Short: "Live monitor all sensor readings (Ctrl+C to stop)",
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("%s📡 Hardware Monitor — bus %d — %dms interval%s\n",
				colorTeal, busNum, interval, colorReset)
			fmt.Printf("%sCtrl+C to stop%s\n\n", colorDim, colorReset)

			hub, err := hardware.NewHardwareHub(busNum)
			if err != nil {
				return fmt.Errorf("hardware init: %w", err)
			}
			defer hub.Close()

			if len(hub.ListAvailable()) == 0 {
				fmt.Printf("%s✗ No sensors detected%s\n", colorRed, colorReset)
				return nil
			}

			sigCh := make(chan os.Signal, 1)
			signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

			ticker := time.NewTicker(time.Duration(interval) * time.Millisecond)
			defer ticker.Stop()

			for {
				select {
				case <-sigCh:
					fmt.Printf("\n%s✓ Monitor stopped%s\n", colorGreen, colorReset)
					hub.Pixels.Clear()
					return nil

				case <-ticker.C:
					env := hub.GetEnvironment()
					fmt.Printf("\r%s[%s]%s", colorDim, time.Now().Format("15:04:05.000"), colorReset)

					if dist, ok := env["distance_mm"].(uint16); ok {
						fmt.Printf("  dist=%s%dmm%s", colorTeal, dist, colorReset)
					}
					if thermo, ok := env["thermo"].(*hardware.ThermoData); ok {
						fmt.Printf("  temp=%s%.1f°C%s  hum=%s%.0f%%%s",
							colorAmber, thermo.Temperature, colorReset,
							colorAmber, thermo.Humidity, colorReset)
					}
					if motion, ok := env["motion"].(*hardware.MotionData); ok {
						fmt.Printf("  pitch=%s%.1f°%s  roll=%s%.1f°%s",
							colorGreen, motion.Pitch, colorReset,
							colorGreen, motion.Roll, colorReset)
					}
					if knob, ok := env["knob"].(*hardware.KnobState); ok {
						fmt.Printf("  knob=%s%d%s", colorPurple, knob.Position, colorReset)
						if knob.Pressed {
							fmt.Printf("%s[PRESS]%s", colorGreen, colorReset)
						}
					}
					if btns, ok := env["buttons"].(*hardware.ButtonState); ok {
						b1, b2, b3 := "○", "○", "○"
						if btns.Button1 {
							b1 = colorGreen + "●" + colorReset
						}
						if btns.Button2 {
							b2 = colorGreen + "●" + colorReset
						}
						if btns.Button3 {
							b3 = colorGreen + "●" + colorReset
						}
						fmt.Printf("  btns=[%s%s%s]", b1, b2, b3)
					}

					fmt.Print("     ") // trailing space to clear line
				}
			}
		},
	}

	cmd.Flags().IntVarP(&busNum, "bus", "b", 1, "I2C bus number")
	cmd.Flags().IntVarP(&interval, "interval", "i", 200, "Poll interval in milliseconds")
	return cmd
}

// ── Demo ─────────────────────────────────────────────────────────────

func NewHardwareDemoCommand() *cobra.Command {
	var busNum int

	cmd := &cobra.Command{
		Use:   "demo",
		Short: "Play SolanaOS trading event animations",
		Long: `Plays the full set of hardware animations:
  signal → trade open → win → loss → learning → error`,
		RunE: func(cmd *cobra.Command, args []string) error {
			fmt.Printf("%s🎬 SolanaOS Hardware Demo%s\n\n", colorGreen, colorReset)

			hub, err := hardware.NewHardwareHub(busNum)
			if err != nil {
				return fmt.Errorf("hardware init: %w", err)
			}
			defer hub.Close()

			if len(hub.ListAvailable()) == 0 {
				fmt.Printf("%s✗ No sensors — cannot demo%s\n", colorRed, colorReset)
				return nil
			}

			steps := []struct {
				label string
				run   func()
			}{
				{"Startup", func() {
					if hub.Buzzer != nil {
						hub.Buzzer.BeepStartup()
					}
					if hub.Pixels != nil {
						for i := 0; i < 8; i++ {
							hub.Pixels.Set(i, hardware.ColorRunning)
							hub.Pixels.Show()
							time.Sleep(80 * time.Millisecond)
						}
					}
				}},
				{"Signal detected", func() {
					fmt.Printf("    %s→ Signal: LONG MAWD%s\n", colorPurple, colorReset)
					if hub.Pixels != nil {
						hub.Pixels.SetAll(hardware.ColorSignal)
						hub.Pixels.Show()
					}
					if hub.Buzzer != nil {
						hub.Buzzer.BeepSignal()
						time.Sleep(150 * time.Millisecond)
						hub.Buzzer.BeepSignal()
					}
					time.Sleep(600 * time.Millisecond)
				}},
				{"Trade opened", func() {
					fmt.Printf("    %s→ Trade open: LONG 0.05 SOL%s\n", colorTeal, colorReset)
					if hub.Pixels != nil {
						hub.Pixels.SetAll(hardware.ColorTrade)
						hub.Pixels.Show()
					}
					if hub.Buzzer != nil {
						hub.Buzzer.BeepTrade()
					}
					time.Sleep(600 * time.Millisecond)
				}},
				{"Win!", func() {
					fmt.Printf("    %s→ Trade closed: +12.4%% WIN%s\n", colorGreen, colorReset)
					if hub.Pixels != nil {
						for i := 0; i < 8; i++ {
							hub.Pixels.Set(i, hardware.ColorWin)
							hub.Pixels.Show()
							time.Sleep(60 * time.Millisecond)
						}
					}
					if hub.Buzzer != nil {
						hub.Buzzer.BeepWin()
					}
					time.Sleep(500 * time.Millisecond)
				}},
				{"Loss", func() {
					fmt.Printf("    %s→ Trade closed: -8.1%% LOSS%s\n", colorRed, colorReset)
					if hub.Pixels != nil {
						for i := 0; i < 2; i++ {
							hub.Pixels.SetAll(hardware.ColorLoss)
							hub.Pixels.Show()
							time.Sleep(200 * time.Millisecond)
							hub.Pixels.Clear()
							time.Sleep(100 * time.Millisecond)
						}
					}
					if hub.Buzzer != nil {
						hub.Buzzer.BeepLoss()
					}
					time.Sleep(600 * time.Millisecond)
				}},
				{"Learning", func() {
					fmt.Printf("    %s→ Learning cycle: wr=58%% pnl=+2.1%%%s\n", colorPurple, colorReset)
					if hub.Pixels != nil {
						for i := 0; i < 3; i++ {
							hub.Pixels.SetAll(hardware.ColorSignal)
							hub.Pixels.Show()
							time.Sleep(200 * time.Millisecond)
							hub.Pixels.Clear()
							time.Sleep(150 * time.Millisecond)
						}
					}
					time.Sleep(300 * time.Millisecond)
				}},
				{"Error", func() {
					fmt.Printf("    %s→ Error: Helius timeout%s\n", colorRed, colorReset)
					if hub.Pixels != nil {
						hub.Pixels.SetAll(hardware.ColorError)
						hub.Pixels.Show()
					}
					if hub.Buzzer != nil {
						hub.Buzzer.BeepError()
					}
					time.Sleep(1000 * time.Millisecond)
				}},
				{"Idle", func() {
					fmt.Printf("    %s→ Idle%s\n", colorDim, colorReset)
					if hub.Pixels != nil {
						hub.Pixels.ShowStatus("idle", 0)
					}
					time.Sleep(600 * time.Millisecond)
					if hub.Pixels != nil {
						hub.Pixels.Clear()
					}
				}},
			}

			for _, step := range steps {
				fmt.Printf("  %s%-20s%s", colorAmber, step.label, colorReset)
				step.run()
				fmt.Printf(" %s✓%s\n", colorGreen, colorReset)
				time.Sleep(200 * time.Millisecond)
			}

			fmt.Printf("\n%s✓ Demo complete%s\n", colorGreen, colorReset)
			return nil
		},
	}

	cmd.Flags().IntVarP(&busNum, "bus", "b", 1, "I2C bus number")
	return cmd
}
