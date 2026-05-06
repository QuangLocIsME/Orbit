const m = require('./dist/server/entry.mjs');
console.log('type:', typeof m);
console.log('keys:', Object.keys(m).slice(0, 20));
console.log('m.default:', typeof m.default);
