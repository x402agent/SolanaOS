#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const serverDir = resolve('.netlify/functions-internal/server')
const mainPath = resolve(serverDir, 'main.mjs')

let src = readFileSync(mainPath, 'utf8')

const MARKER = '// PATCHED_TEXT_RESPONSE'
if (src.includes(MARKER)) {
  console.log('[patch] Already patched')
  process.exit(0)
}

// Remove any previous patch markers
src = src.replace(/\/\/ PATCHED_BUFFERED_RESPONSE\n/g, '')
src = src.replace(/\/\/ PATCHED_EAGER_BODY\n/g, '')

// Replace "return response;" with text-based reconstruction
// Use text() not arrayBuffer() to guarantee no null bytes
src = src.replace(
  /  return response;\n};/,
  `  ${MARKER}
  const __txt = await response.text();
  const __h = {};
  response.headers.forEach((v, k) => { __h[k] = v; });
  __h['content-length'] = String(Buffer.byteLength(__txt, 'utf8'));
  delete __h['transfer-encoding'];
  return new globalThis.Response(__txt, {
    status: response.status,
    statusText: response.statusText || 'OK',
    headers: __h,
  });
};`
)

// Also patch the already-patched version if present
src = src.replace(
  /  \/\/ PATCHED_BUFFERED_RESPONSE[\s\S]*?return new globalThis\.Response\(__buf[\s\S]*?\);\n};/,
  `  ${MARKER}
  const __txt = await response.text();
  const __h = {};
  response.headers.forEach((v, k) => { __h[k] = v; });
  __h['content-length'] = String(Buffer.byteLength(__txt, 'utf8'));
  delete __h['transfer-encoding'];
  return new globalThis.Response(__txt, {
    status: response.status,
    statusText: response.statusText || 'OK',
    headers: __h,
  });
};`
)

writeFileSync(mainPath, src, 'utf8')

// Also update server.mjs config
const serverPath = resolve(serverDir, 'server.mjs')
let serverSrc = readFileSync(serverPath, 'utf8')
writeFileSync(serverPath, serverSrc, 'utf8')

console.log('[patch] Patched handler with text-based response')
