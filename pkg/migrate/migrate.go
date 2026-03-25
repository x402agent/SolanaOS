// Package migrate provides config migration for MawdBot.
// Adapted from PicoClaw — version-based config file upgrades.
package migrate

import (
	"encoding/json"
	"fmt"
	"os"
)

type Migration struct {
	FromVersion int
	ToVersion   int
	Description string
	Apply       func(data map[string]any) (map[string]any, error)
}

var migrations = []Migration{
	{
		FromVersion: 0,
		ToVersion:   1,
		Description: "Initial MawdBot config schema",
		Apply: func(data map[string]any) (map[string]any, error) {
			if _, ok := data["version"]; !ok {
				data["version"] = 1
			}
			return data, nil
		},
	},
	{
		FromVersion: 1,
		ToVersion:   2,
		Description: "Add Solana connector configs",
		Apply: func(data map[string]any) (map[string]any, error) {
			if _, ok := data["solana"]; !ok {
				data["solana"] = map[string]any{
					"helius":  map[string]any{},
					"birdeye": map[string]any{},
					"jupiter": map[string]any{},
					"aster":   map[string]any{},
				}
			}
			data["version"] = 2
			return data, nil
		},
	},
}

// RunMigrations applies all migrations up to the latest version.
func RunMigrations(configPath string) error {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil // no file to migrate
	}

	var config map[string]any
	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("parse config: %w", err)
	}

	currentVersion := 0
	if v, ok := config["version"].(float64); ok {
		currentVersion = int(v)
	}

	for _, m := range migrations {
		if m.FromVersion >= currentVersion && m.ToVersion > currentVersion {
			config, err = m.Apply(config)
			if err != nil {
				return fmt.Errorf("migration %d→%d failed: %w", m.FromVersion, m.ToVersion, err)
			}
			currentVersion = m.ToVersion
		}
	}

	result, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath, result, 0644)
}

// LatestVersion returns the highest version number.
func LatestVersion() int {
	if len(migrations) == 0 {
		return 0
	}
	return migrations[len(migrations)-1].ToVersion
}
