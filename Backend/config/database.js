const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  const dbUrl = process.env.MONGODB_URI;
  if (!dbUrl) {
    throw new Error('Thiếu biến môi trường MONGODB_URI');
  }

  try {
    const isProduction = process.env.IS_PRODUCTION === 'true';
    mongoose.set('strictQuery', !isProduction);
    mongoose.set('autoIndex', isProduction);

    const dbConnection = mongoose.connection;

    dbConnection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    dbConnection.once('open', () => {
      console.log(`✅ MongoDB Connected: ${dbConnection.host}`);
    });

    dbConnection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
    });

    dbConnection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected successfully');
    });

    await mongoose.connect(dbUrl, {
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 20,
      minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 5,
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000,
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 45000,
      heartbeatFrequencyMS: Number(process.env.MONGO_HEARTBEAT_FREQUENCY_MS) || 10000,
      retryWrites: true,
      w: 'majority',
    });
  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
