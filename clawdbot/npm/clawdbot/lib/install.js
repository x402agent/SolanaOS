"use strict";

const fs = require("fs");
const { resolveBin, vendorPath } = require("./resolve");

const pkgRoot = pathResolve();
function pathResolve() {
  return require("path").join(__dirname, "..");
}

const bin = resolveBin(pkgRoot);
if (fs.existsSync(bin)) {
  try {
    fs.chmodSync(bin, 0o755);
  } catch {
    // ignore
  }
  process.stdout.write(`clawdbot ready: ${bin}\n`);
  process.exit(0);
}

const expected = vendorPath(pkgRoot);
process.stderr.write(
  `clawdbot: no vendor binary at ${expected}. ` +
    `The packed tarball from \`make npm-pack\` includes the current-platform binary.\n`
);
process.exit(0);
