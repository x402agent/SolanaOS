#!/usr/bin/env node
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const { requireBin } = require("../lib/resolve");

const pkgRoot = path.join(__dirname, "..");
let bin;
try {
  bin = requireBin(pkgRoot);
} catch (err) {
  process.stderr.write(String(err.message || err) + "\n");
  process.exit(1);
}

const result = spawnSync(bin, process.argv.slice(2), { stdio: "inherit" });
if (result.error) {
  process.stderr.write(result.error.message + "\n");
  process.exit(1);
}
process.exit(result.status == null ? 1 : result.status);
