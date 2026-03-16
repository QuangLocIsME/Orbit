/**
 * One-time script: xóa index "username_1" trên collection users
 * (gây lỗi E11000 duplicate key khi đăng nhập Google vì nhiều user có username: null)
 * Chạy: node scripts/drop-username-index.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('Thiếu MONGODB_URI trong .env');
        process.exit(1);
    }
    await mongoose.connect(uri);
    try {
        const col = mongoose.connection.collection('users');
        const indexes = await col.indexes();
        const hasUsername = indexes.some((i) => i.name === 'username_1');
        if (hasUsername) {
            await col.dropIndex('username_1');
            console.log('Đã xóa index username_1.');
        } else {
            console.log('Không có index username_1 (đã xóa trước đó hoặc chưa từng có).');
        }
    } finally {
        await mongoose.disconnect();
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
