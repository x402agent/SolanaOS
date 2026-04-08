# Hardware Deployment Guide

SolanaOS can run as a pure software runtime or attach to Arduino Modulino hardware over I2C for local operator feedback and controls.

## Supported targets

| Board | Arch | Build target | Notes |
| --- | --- | --- | --- |
| NVIDIA Orin Nano / NX | arm64 | `make orin` | Primary hardware target |
| Raspberry Pi 4 / 5 | arm64 | `make rpi` | Good low-cost target |
| RISC-V boards | riscv64 | `make riscv` | Experimental |
| x86 Linux | amd64 | `make build` | Software-only unless custom hardware wiring |
| macOS / Windows | arm64 / amd64 | `make build` | Stub mode, no real I2C |

## Supported Modulino devices

| Device | I2C addr | Runtime role |
| --- | --- | --- |
| Pixels | `0x6C` | status LEDs and animations |
| Buzzer | `0x3C` | signal, trade, win, and error tones |
| Buttons | `0x7C` | trigger cycle, toggle mode, emergency action |
| Knob | `0x76` | live strategy tuning |
| Movement | `0x6A` | tilt / disturbance detection |
| Thermo | `0x44` | temperature and humidity |
| Distance | `0x29` | proximity trigger |

## HAL model

SolanaOS uses a build-tag hardware abstraction layer:

- Linux builds use the real I2C/GPIO implementation
- non-Linux builds fall back to a stub HAL

That means the same runtime can:

- drive real hardware on Orin or Raspberry Pi
- run locally on macOS with no attached hardware and no fatal errors

## NVIDIA Orin Nano setup

### 1. Enable I2C

```bash
ls /dev/i2c-*
sudo /opt/nvidia/jetson-io/jetson-io.py
sudo apt install -y i2c-tools
sudo i2cdetect -y 1
```

### 2. Build and copy the binary

```bash
make orin
scp build/solanaos-orin user@orin-nano:~/solanaos
```

### 3. Install and configure

```bash
ssh user@orin-nano
chmod +x ~/solanaos
sudo mv ~/solanaos /usr/local/bin/solanaos
sudo usermod -aG i2c $USER
```

Create your runtime home and env:

```bash
mkdir -p ~/.solanaos
cp /path/to/repo/.env.example ~/.solanaos/.env
nano ~/.solanaos/.env
```

### 4. Verify hardware

```bash
solanaos hardware scan --bus 1
solanaos hardware test --bus 1
solanaos hardware monitor --bus 1 --interval 200
```

## Raspberry Pi setup

### 1. Enable I2C

```bash
sudo raspi-config
sudo apt install -y i2c-tools
sudo i2cdetect -y 1
```

### 2. Build and copy

```bash
make rpi
scp build/solanaos-rpi pi@raspberrypi:~/solanaos
```

### 3. Run

```bash
ssh pi@raspberrypi
chmod +x ~/solanaos
./solanaos hardware scan --bus 1
./solanaos ooda --hw-bus 1 --interval 30
```

## Wiring

All Modulino nodes connect via Qwiic / I2C daisy-chain.

Typical Raspberry Pi pins:

- SDA: GPIO 2 / pin 3
- SCL: GPIO 3 / pin 5
- 3.3V: pin 1
- GND: pin 6

Typical chain:

```text
Host board
  -> Distance
  -> Movement
  -> Thermo
  -> Pixels
  -> Buzzer
  -> Buttons
  -> Knob
```

## Runtime mapping

| Event | Hardware behavior |
| --- | --- |
| Idle | slow blue / teal LED pulse |
| Signal detected | purple flash |
| Trade opened | amber / yellow sweep |
| Win | green cascade |
| Loss | red alert pattern |
| Learning cycle | purple pulse |
| Error | solid red + error tone |
| Knob turn | adjust strategy parameter |
| Button press | trigger action |

## Common commands

```bash
solanaos hardware scan --bus 1
solanaos hardware test --bus 1
solanaos hardware monitor --bus 1
solanaos hardware demo --bus 1
solanaos ooda --hw-bus 1 --interval 30
solanaos ooda --no-hw --interval 30
```

## systemd example

```ini
[Unit]
Description=SolanaOS Runtime
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=solanaos
Group=i2c
EnvironmentFile=/home/solanaos/.solanaos/.env
ExecStart=/usr/local/bin/solanaos ooda --interval 60 --hw-bus 1
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/home/solanaos/.solanaos
SupplementaryGroups=i2c
DeviceAllow=/dev/i2c-1 rw

[Install]
WantedBy=multi-user.target
```

Load it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable solanaos
sudo systemctl start solanaos
sudo journalctl -u solanaos -f
```

## Docker

```bash
docker build -t solanaos .

docker run --rm \
  --device /dev/i2c-1 \
  --env-file .env \
  solanaos ooda --interval 60 --hw-bus 1
```

For broader device access:

```bash
docker run --rm \
  --privileged \
  --env-file .env \
  solanaos ooda --interval 60 --hw-bus 1
```

## Monitoring

```bash
solanaos hardware monitor
solanaos status
journalctl -u solanaos -f --no-pager
ps aux | grep solanaos
```

## Notes

- Hardware is optional. The daemon should still run cleanly with no sensors attached.
- If you are building on macOS, expect stub-mode behavior unless you deploy the Linux binary to real hardware.
- For runtime issues beyond wiring and I2C detection, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
