require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const connectDB = require('./config/database');
const { startCdcSyncService } = require('./services/cdcSync.service');

// Register the Mongoose models watched by the CDC service before opening streams.
require('./models/Project');
require('./models/ProjectInvite');
require('./models/ProjectMember');
require('./models/ProjectRole');
require('./models/Team');
require('./models/TeamMember');
require('./models/Activity');
require('./models/Package');
require('./models/UploadApproval');

async function main() {
    await connectDB();
    startCdcSyncService();
}

main().catch((error) => {
    console.error('[CDC] startup failed:', error?.message || error);
    process.exit(1);
});
