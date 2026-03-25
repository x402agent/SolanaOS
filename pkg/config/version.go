package config

import (
	"fmt"
	"runtime"
)

// Build-time variables injected via ldflags.
//
//	-X github.com/x402agent/Solana-Os-Go/pkg/config.Version=<version>
//	-X github.com/x402agent/Solana-Os-Go/pkg/config.GitCommit=<commit>
//	-X github.com/x402agent/Solana-Os-Go/pkg/config.BuildTime=<timestamp>
//	-X github.com/x402agent/Solana-Os-Go/pkg/config.GoVersion=<go-version>
var (
	Version   = "dev"
	GitCommit string
	BuildTime string
	GoVersion string
)

func FormatVersion() string {
	v := Version
	if GitCommit != "" {
		v += fmt.Sprintf(" (git: %s)", GitCommit)
	}
	return v
}

func FormatBuildInfo() (string, string) {
	build := BuildTime
	goVer := GoVersion
	if goVer == "" {
		goVer = runtime.Version()
	}
	return build, goVer
}

func GetVersion() string {
	return Version
}
