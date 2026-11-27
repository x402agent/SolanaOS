package packaging

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// NPMPackageName is the intended unscoped publish name.
const NPMPackageName = "clawdbot"

// NPMFallbackName is used when the unscoped name is already owned.
const NPMFallbackName = "@clawd/clawdbot"

// PackageMeta is the subset of package.json the installer and tests care about.
type PackageMeta struct {
	Name string            `json:"name"`
	Bin  map[string]string `json:"bin"`
}

// ParsePackageJSON reads name + bin from a package.json document.
func ParsePackageJSON(data []byte) (PackageMeta, error) {
	var raw struct {
		Name string          `json:"name"`
		Bin  json.RawMessage `json:"bin"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return PackageMeta{}, fmt.Errorf("parse package.json: %w", err)
	}
	meta := PackageMeta{Name: raw.Name, Bin: map[string]string{}}
	if len(raw.Bin) == 0 {
		return meta, fmt.Errorf("package.json is missing bin")
	}
	if raw.Bin[0] == '"' {
		var path string
		if err := json.Unmarshal(raw.Bin, &path); err != nil {
			return PackageMeta{}, err
		}
		meta.Bin[binNameFromPackage(raw.Name)] = path
		return meta, nil
	}
	if err := json.Unmarshal(raw.Bin, &meta.Bin); err != nil {
		return PackageMeta{}, fmt.Errorf("parse bin: %w", err)
	}
	return meta, nil
}

func binNameFromPackage(name string) string {
	name = strings.TrimSpace(name)
	if i := strings.LastIndex(name, "/"); i >= 0 {
		return name[i+1:]
	}
	return name
}

// ValidateClawdbotPackage checks that a packed package exposes the clawdbot bin.
func ValidateClawdbotPackage(meta PackageMeta) error {
	if meta.Name != NPMPackageName && meta.Name != NPMFallbackName {
		return fmt.Errorf("unexpected package name %q (want %s or %s)", meta.Name, NPMPackageName, NPMFallbackName)
	}
	path, ok := meta.Bin[NPMPackageName]
	if !ok || strings.TrimSpace(path) == "" {
		return fmt.Errorf("package %s does not expose bin %s", meta.Name, NPMPackageName)
	}
	return nil
}

// VendorBinaryRelPath is the relative path of a platform binary inside the npm package.
func VendorBinaryRelPath(goos, goarch string) string {
	return filepath.Join("vendor", goos+"-"+goarch, "clawdbot")
}

// StageVendorBinary copies a built clawdbot into the npm package vendor tree.
func StageVendorBinary(packageDir, binaryPath, goos, goarch string) (string, error) {
	dest := filepath.Join(packageDir, VendorBinaryRelPath(goos, goarch))
	if err := copyFile(binaryPath, dest, 0o755); err != nil {
		return "", err
	}
	return dest, nil
}

// LoadRepoPackageJSON reads npm/clawdbot/package.json from a repo root.
func LoadRepoPackageJSON(repoRoot string) (PackageMeta, error) {
	data, err := os.ReadFile(filepath.Join(repoRoot, "npm", "clawdbot", "package.json"))
	if err != nil {
		return PackageMeta{}, err
	}
	return ParsePackageJSON(data)
}
