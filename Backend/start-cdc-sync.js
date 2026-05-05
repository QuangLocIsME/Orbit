require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const connectDB = require('./config/database');
const { startCdcSyncService } = require('./services/cdcSync.service');

async function main() {
    await connectDB();
    startCdcSyncService();
}

main().catch((error) => {
    console.error('[CDC] startup failed:', error?.message || error);
    process.exit(1);
});
