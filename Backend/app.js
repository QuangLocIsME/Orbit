const express = require('express');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const connectDB = require('./config/database');

const app = express();

app.use(express.json());
app.use(cookieParser());

connectDB();

app.use('/api/auth', authRoutes);

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

module.exports = app;
