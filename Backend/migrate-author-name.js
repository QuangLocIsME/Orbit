require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');

const WorkflowTemplate = require('./models/WorkflowTemplate');
const User = require('./models/User');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const templates = await WorkflowTemplate.find({});
    let updated = 0;
    let skipped = 0;

    for (const template of templates) {
      const isAnonymous = template.authorName === 'Anonymous' || !template.authorName;

      if (!isAnonymous) {
        console.log(`  [SKIP] "${template.name}" already has name: "${template.authorName}"`);
        skipped++;
        continue;
      }

      const user = await User.findOne({ _id: template.authorId });
      if (!user) {
        console.log(`  [SKIP] No user found for authorId: ${template.authorId}`);
        skipped++;
        continue;
      }

      template.authorName = user.fullName || user.email;
      await template.save();
      updated++;
      console.log(`  [OK] "${template.name}" — set to "${template.authorName}"`);
    }

    console.log(`\nMigration complete. Updated ${updated} templates, skipped ${skipped}.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrate();
