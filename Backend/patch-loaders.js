// Script to patch loaders.gl polyfills for Node.js ESM compatibility
const path = require('path');
const fs = require('fs');

const loadersPolyfillsPath = path.join(__dirname, 'node_modules', '@loaders.gl', 'polyfills');

// Find all .node.js files
function findNodeJsFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            findNodeJsFiles(fullPath, files);
        } else if (item.endsWith('.node.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

const nodeJsFiles = findNodeJsFiles(loadersPolyfillsPath);
console.log('Found .node.js files:', nodeJsFiles);

// For each .node.js file, find all imports that reference it and patch them
const baseNameMap = {};
for (const file of nodeJsFiles) {
    const dir = path.dirname(file);
    const name = path.basename(file, '.js'); // e.g., 'btoa.node' from 'btoa.node.js'
    baseNameMap[name] = file;
    console.log(`  ${name} -> ${file}`);
}

// Now patch all .js and .ts files that import these
function patchImports(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            patchImports(fullPath);
        } else if ((item.endsWith('.js') || item.endsWith('.ts')) && !item.endsWith('.d.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            
            for (const [baseName, jsFile] of Object.entries(baseNameMap)) {
                const relativeDir = path.dirname(jsFile).replace(loadersPolyfillsPath + path.sep, '');
                const relativePath = './' + relativeDir.replace(/\\/g, '/') + '/' + baseName;
                
                // Pattern to match import from this file without .js extension
                const patterns = [
                    new RegExp(`from ['"]${relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
                    new RegExp(`from ["']${relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g')
                ];
                
                for (const pattern of patterns) {
                    if (pattern.test(content)) {
                        content = content.replace(pattern, `from '${relativePath}.js'`);
                        modified = true;
                    }
                }
            }
            
            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log(`Patched: ${fullPath.replace(__dirname + path.sep, '')}`);
            }
        }
    }
}

console.log('\nPatching imports...');
patchImports(loadersPolyfillsPath);
console.log('\nDone!');
