const mongoose = require('mongoose')

let connected = false

async function connectDb() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sunwin-farm'
  if (connected) return mongoose.connection

  mongoose.set('strictQuery', true)
  await mongoose.connect(uri)
  connected = true
  console.log(`MongoDB connected: ${uri}`)
  return mongoose.connection
}

function isDbReady() {
  return connected && mongoose.connection.readyState === 1
}

module.exports = { connectDb, isDbReady, mongoose }
