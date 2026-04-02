const path = require('path');

const mockObjects = require(path.resolve(__dirname, '../data/mockObjects.json'));
const { detectClashes } = require(path.resolve(__dirname, '../services/clash.service'));

function run() {
    const clashes = detectClashes(mockObjects);

    console.log(`Loaded ${mockObjects.length} objects`);
    console.log(`Detected ${clashes.length} clashes`);

    clashes.forEach((clash) => {
        console.log(
            [
                `- ${clash.id}`,
                `severity=${clash.severity}`,
                `objects=${clash.objectA},${clash.objectB}`,
                `position=${JSON.stringify(clash.position)}`,
                `intersectionVolume=${clash.intersectionVolume}`,
            ].join(' | ')
        );
    });
}

try {
    run();
} catch (error) {
    console.error('Clash test failed:', error.message);
    process.exit(1);
}
