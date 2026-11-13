// src/db/connection.js
// Connects to MongoDB via Mongoose.
// Includes graceful fallback to file persistence so the backend will never crash
// if run in restricted or offline sandbox environments.

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/holiday-package';
  try {
    // Attempt connection with a 2-second timeout
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    isConnected = true;
    console.log(`✅ MongoDB connected successfully at ${uri}`);
  } catch (err) {
    console.warn(`⚠️ MongoDB connection not available (${err.message}). Using local JSON store fallback.`);
    isConnected = false;
  }
}

function isMongoConnected() {
  return isConnected;
}

module.exports = {
  connectDB,
  isMongoConnected,
};
