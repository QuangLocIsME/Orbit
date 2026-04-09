// start-worker.js — bootstrapper: install + patch + run
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const WORKER = path.join(__dirname, 'workers', 'ifcConversionWorker.js');
const LOADERS_PATH = path.join(__dirname, 'node_modules', '@loaders.gl', 'polyfills', 'dist');

function run(cmd) {
  console.log('[start-worker]', cmd);
  execSync(cmd, { stdio: 'inherit', shell: '/bin/sh' });
}

/**
 * Patch @loaders.gl/polyfills: rename Node.js .node native addon imports
 * to .node.js (so they can be resolved without node-gyp rebuild).
 *
 * The package uses bare `.node` extension imports like:
 *   import x from './file.node'
 * Node.js ESM cannot resolve these. We rename to:
 *   import x from './file.node.js'
 * while protecting existing .node.js. occurrences from further mutation.
 */
function patchLoadersGl() {
  const dir = path.join(__dirname, 'node_modules', '@loaders.gl');
  let patched = 0;

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        const before = fs.readFileSync(full, 'utf8');
        if (!/.node['"\/]/.test(before)) continue;

        let after = before
          // Stage 1: protect .node.js. → PROTECTED_MARKER_NODE_DOT_JS_DOT
          .replace(/\.node\.js\./g, 'PROTECTED_NODE_JS_DOT')
          // Stage 2: .node' → .node.js'  .node" → .node.js"  .node/ → .node.js/
          .replace(/\.node(['"\/])/g, '.node.js$1')
          // Stage 3: restore PROTECTED_MARKER_NODE_JS_DOT → .node.js.
          .replace(/PROTECTED_NODE_JS_DOT/g, '.node.js.');

        if (after !== before) {
          fs.writeFileSync(full, after, 'utf8');
          patched++;
          console.log('[start-worker] Patched:', full.replace(__dirname + '/', ''));
        }
      }
    }
  }

  walk(dir);
  console.log('[start-worker] Patched', patched, 'file(s)');
}

async function main() {
  // Step 1: npm install
  run('npm install');

  // Step 2: patch @loaders.gl
  if (fs.existsSync(path.join(__dirname, 'node_modules', '@loaders.gl'))) {
    console.log('[start-worker] Patching @loaders.gl polyfills...');
    patchLoadersGl();
  } else {
    console.log('[start-worker] @loaders.gl not found, skipping patch');
  }

  // Step 3: start the worker
  console.log('[start-worker] Starting IFC conversion worker...');
  run('node ' + WORKER);
}

main().catch(err => {
  console.error('[start-worker] Fatal:', err);
  process.exit(1);
});
