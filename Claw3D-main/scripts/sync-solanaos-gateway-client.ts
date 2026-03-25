import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const requestedSourcePath =
  process.argv[2]?.trim() ||
  process.env.SOLANAOS_GATEWAY_CLIENT_SOURCE?.trim() ||
  process.env.SOLANAOS_UI_PATH?.trim() ||
  "";
const sourcePath = requestedSourcePath
  ? path.resolve(requestedSourcePath)
  : "";
const destPath = path.join(
  repoRoot,
  "src",
  "lib",
  "gateway",
  "solanaos",
  "GatewayBrowserClient.ts"
);

if (!sourcePath) {
  console.error(
    "Missing upstream gateway client source path. Provide it as `npm run sync:gateway-client -- /path/to/gateway.ts` or set SOLANAOS_GATEWAY_CLIENT_SOURCE."
  );
  process.exit(1);
}

if (!fs.existsSync(sourcePath)) {
  console.error(`Missing upstream gateway client at ${sourcePath}.`);
  process.exit(1);
}

let contents = fs.readFileSync(sourcePath, "utf8");
contents = contents
  .replace(
    /from "\.\.\/\.\.\/\.\.\/src\/gateway\/protocol\/client-info\.js";/g,
    'from "./client-info";'
  )
  .replace(
    /from "\.\.\/\.\.\/\.\.\/src\/gateway\/device-auth\.js";/g,
    'from "./device-auth-payload";'
  );

fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.writeFileSync(destPath, contents, "utf8");
console.log(`Synced gateway client to ${destPath}.`);
