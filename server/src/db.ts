const mongoose = require('mongoose');

const connect = async (uri: string) => {
  if (!uri) throw new Error('MONGODB_URI not provided');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
};

module.exports = { connect, mongoose };
