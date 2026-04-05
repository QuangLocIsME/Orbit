require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const mongoose = require('mongoose');

async function checkConversionStatus() {
    await mongoose.connect(process.env.MONGODB_URI);

    const docs = await mongoose.connection.db.collection('documents').find({
        conversionStatus: { $in: ['PENDING', 'PROCESSING', 'READY', 'FAILED'] }
    }).sort({ createdAt: -1 }).limit(10).toArray();

    console.log('\n=== IFC Conversion Status ===\n');
    console.log(`Found ${docs.length} IFC document(s)\n`);

    for (const doc of docs) {
        console.log(`File: ${doc.originalName}`);
        console.log(`  Status: ${doc.conversionStatus}`);
        console.log(`  xktUrl: ${doc.xktUrl || '(not converted yet)'}`);
        console.log(`  Error: ${doc.conversionError || '-'}`);
        console.log(`  Converted: ${doc.convertedAt ? new Date(doc.convertedAt).toLocaleString() : '-'}`);
        console.log('  ---');
    }

    await mongoose.disconnect();
}

checkConversionStatus().catch(console.error);
