// patch-loaders-gl.js — patch @loaders.gl .node imports for Node.js ESM compatibility
const fs = require('fs');
const path = require('path');

const APP_DIR = process.env.APP_DIR || '/app';
const dir = path.join(APP_DIR, 'node_modules', '@loaders.gl');
let patched = 0;

function walk(d) {
  const entries = fs.readdirSync(d, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(d, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const before = fs.readFileSync(full, 'utf8');
      if (!/\.node['"\\\/]/.test(before)) continue;
      let after = before
        .replace(/\.node\.js\./g, 'PROTECTED_NODE_JS_DOT')
        .replace(/\.node(['"\\\/])/g, '.node.js$1')
        .replace(/PROTECTED_NODE_JS_DOT/g, '.node.js.');
      if (after !== before) {
        fs.writeFileSync(full, after, 'utf8');
        patched++;
        console.log('[patch] ' + full.replace(APP_DIR + '/', ''));
      }
    }
  }
}

if (fs.existsSync(dir)) {
  walk(dir);
  console.log('[patch] Done. Patched ' + patched + ' file(s)');
} else {
  console.log('[patch] @loaders.gl not found, skipping');
}
