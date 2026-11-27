package packaging

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	// DefaultAppName is the Grok-like two-word Finder name.
	DefaultAppName = "Clawd Bot"
	// DefaultBundleID is the macOS application identifier.
	DefaultBundleID = "ai.clawd.ClawdBot"
	// DefaultExecutable is CFBundleExecutable (no space; path-safe).
	DefaultExecutable = "ClawdBot"
	// DefaultIconFile is the icns name inside Contents/Resources.
	DefaultIconFile = "icon.icns"
	// ApplicationsAliasName is the DMG drop-target name.
	ApplicationsAliasName = "Applications"
)

// AppOptions describe a Grok-like APPL bundle.
type AppOptions struct {
	Name         string
	BundleID     string
	Version      string
	Executable   string
	IconFile     string
	BinaryPath   string
	IconPath     string
	ResourceHTML string
}

func (o AppOptions) normalized() AppOptions {
	if o.Name == "" {
		o.Name = DefaultAppName
	}
	if o.BundleID == "" {
		o.BundleID = DefaultBundleID
	}
	if o.Version == "" {
		o.Version = "dev"
	}
	if o.Executable == "" {
		o.Executable = DefaultExecutable
	}
	if o.IconFile == "" {
		o.IconFile = DefaultIconFile
	}
	return o
}

// BuildInfoPlist returns a real macOS APPL Info.plist for Clawd Bot.
func BuildInfoPlist(opts AppOptions) string {
	opts = opts.normalized()
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>en</string>
	<key>CFBundleDisplayName</key>
	<string>%s</string>
	<key>CFBundleExecutable</key>
	<string>%s</string>
	<key>CFBundleIconFile</key>
	<string>%s</string>
	<key>CFBundleIdentifier</key>
	<string>%s</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>%s</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>%s</string>
	<key>CFBundleVersion</key>
	<string>%s</string>
	<key>LSApplicationCategoryType</key>
	<string>public.app-category.developer-tools</string>
	<key>LSMinimumSystemVersion</key>
	<string>12.0</string>
	<key>NSHighResolutionCapable</key>
	<true/>
	<key>NSPrincipalClass</key>
	<string>NSApplication</string>
</dict>
</plist>
`, opts.Name, opts.Executable, opts.IconFile, opts.BundleID, opts.Name, opts.Version, opts.Version)
}

// ValidateInfoPlist checks the Grok-like APPL fields the DMG gate requires.
func ValidateInfoPlist(data []byte) error {
	s := string(data)
	if !strings.Contains(s, "<string>APPL</string>") {
		return fmt.Errorf("CFBundlePackageType is not APPL")
	}
	if !strings.Contains(s, "Clawd") && !strings.Contains(s, "ClawdBot") {
		return fmt.Errorf("plist is missing a Clawd/ClawdBot display name")
	}
	if !strings.Contains(s, "CFBundleExecutable") {
		return fmt.Errorf("plist is missing CFBundleExecutable")
	}
	return nil
}

// ValidateIcon reports whether path is a non-trivial icns/png icon.
func ValidateIcon(path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("icon: %w", err)
	}
	if info.IsDir() {
		return fmt.Errorf("icon %s is a directory", path)
	}
	if info.Size() < 1024 {
		return fmt.Errorf("icon %s is too small (%d bytes)", path, info.Size())
	}
	return nil
}

// AppBundlePath returns <root>/<Name>.app.
func AppBundlePath(root, name string) string {
	if name == "" {
		name = DefaultAppName
	}
	return filepath.Join(root, name+".app")
}

// StageApp writes a Grok-like .app bundle under root.
func StageApp(root string, opts AppOptions) (string, error) {
	opts = opts.normalized()
	app := AppBundlePath(root, opts.Name)
	macos := filepath.Join(app, "Contents", "MacOS")
	resources := filepath.Join(app, "Contents", "Resources")
	for _, dir := range []string{macos, resources} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return "", err
		}
	}
	plist := BuildInfoPlist(opts)
	if err := ValidateInfoPlist([]byte(plist)); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(app, "Contents", "Info.plist"), []byte(plist), 0o644); err != nil {
		return "", err
	}
	if err := os.WriteFile(filepath.Join(app, "Contents", "PkgInfo"), []byte("APPL????"), 0o644); err != nil {
		return "", err
	}

	destBin := filepath.Join(macos, opts.Executable)
	if opts.BinaryPath != "" {
		if err := copyFile(opts.BinaryPath, destBin, 0o755); err != nil {
			return "", fmt.Errorf("copy executable: %w", err)
		}
	} else if _, err := os.Stat(destBin); err != nil {
		return "", fmt.Errorf("missing MacOS executable %s", destBin)
	}

	if opts.IconPath != "" {
		if err := ValidateIcon(opts.IconPath); err != nil {
			return "", err
		}
		if err := copyFile(opts.IconPath, filepath.Join(resources, opts.IconFile), 0o644); err != nil {
			return "", fmt.Errorf("copy icon: %w", err)
		}
	}
	if opts.ResourceHTML != "" {
		if err := copyFile(opts.ResourceHTML, filepath.Join(resources, "studio.html"), 0o644); err != nil {
			return "", fmt.Errorf("copy studio html: %w", err)
		}
	}
	return app, nil
}

// StageDMGRoot lays out a studio-style DMG source folder: the .app plus an
// Applications symlink so users drag the app into /Applications.
func StageDMGRoot(root string, opts AppOptions) error {
	if _, err := StageApp(root, opts); err != nil {
		return err
	}
	alias := filepath.Join(root, ApplicationsAliasName)
	if err := os.RemoveAll(alias); err != nil {
		return err
	}
	return os.Symlink("/Applications", alias)
}

// ValidateDMGRoot checks the studio layout: *.app + Applications alias + icns + APPL plist.
func ValidateDMGRoot(root string) error {
	entries, err := os.ReadDir(root)
	if err != nil {
		return err
	}
	var appPath, appsPath string
	for _, e := range entries {
		name := e.Name()
		if strings.HasSuffix(name, ".app") {
			appPath = filepath.Join(root, name)
		}
		if name == ApplicationsAliasName {
			appsPath = filepath.Join(root, name)
		}
	}
	if appPath == "" {
		return fmt.Errorf("no .app bundle in %s", root)
	}
	if appsPath == "" {
		return fmt.Errorf("no Applications alias in %s", root)
	}
	info, err := os.Lstat(appsPath)
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink == 0 {
		return fmt.Errorf("Applications is not a symlink/alias")
	}
	plist, err := os.ReadFile(filepath.Join(appPath, "Contents", "Info.plist"))
	if err != nil {
		return fmt.Errorf("read Info.plist: %w", err)
	}
	if err := ValidateInfoPlist(plist); err != nil {
		return err
	}
	icon := filepath.Join(appPath, "Contents", "Resources", DefaultIconFile)
	if err := ValidateIcon(icon); err != nil {
		return err
	}
	execName := DefaultExecutable
	if _, err := os.Stat(filepath.Join(appPath, "Contents", "MacOS", execName)); err != nil {
		return fmt.Errorf("missing MacOS executable: %w", err)
	}
	return nil
}

func copyFile(src, dst string, mode os.FileMode) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	return os.WriteFile(dst, data, mode)
}
