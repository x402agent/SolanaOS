"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

function platformKey() {
  const goos = process.env.npm_config_platform || process.platform;
  const goarch = process.env.npm_config_arch || process.arch;
  const mappedOS = goos === "win32" ? "windows" : goos;
  const mappedArch = goarch === "x64" ? "amd64" : goarch;
  return { goos: mappedOS, goarch: mappedArch };
}

function vendorPath(pkgRoot) {
  const { goos, goarch } = platformKey();
  const name = process.platform === "win32" ? "clawdbot.exe" : "clawdbot";
  return path.join(pkgRoot, "vendor", `${goos}-${goarch}`, name);
}

function resolveBin(pkgRoot) {
  if (process.env.CLAWDBOT_BIN) {
    return process.env.CLAWDBOT_BIN;
  }
  const vendor = vendorPath(pkgRoot);
  if (fs.existsSync(vendor)) {
    return vendor;
  }
  const sibling = path.resolve(pkgRoot, "..", "..", "build", "clawdbot");
  if (fs.existsSync(sibling)) {
    return sibling;
  }
  return vendor;
}

function requireBin(pkgRoot) {
  const bin = resolveBin(pkgRoot);
  if (!fs.existsSync(bin)) {
    const { goos, goarch } = platformKey();
    throw new Error(
      `clawdbot binary not found for ${goos}/${goarch}. ` +
        `Set CLAWDBOT_BIN or run \`make build\` / \`make npm-pack\` first. Looked at ${bin}`
    );
  }
  try {
    fs.chmodSync(bin, 0o755);
  } catch {
    // best-effort on platforms that ignore chmod
  }
  return bin;
}

module.exports = { platformKey, vendorPath, resolveBin, requireBin };
